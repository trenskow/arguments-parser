//
// index.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2026/08/02
// See license in LICENSE.
//

import {
	basename
} from 'path';

import {
	keyPaths,
	merge
} from 'isvalid';

import caseit from '@trenskow/caseit';

import bash from './bash.js';
import zsh from './zsh.js';

const supported = {
	bash,
	zsh
};

const argumentsParser = (shell) => {

	if (!shell) return;

	shell = supported[shell];

	if (!shell) {
		process.stderr.write(`Unsupported shell: ${shell}\n`);
		process.exit(1);
	}

	const normalize = (items) => items
		.map((item) => {

			if (typeof item === 'string') {
				return {
					type: 'option',
					argument: item
				};
			}

			return item;

		});

	const filter = (items, current) => {
		return normalize(items)
			.filter((item) => {
				switch (item.type) {
					case 'option':
						// fall through
					case 'command':
						return item.argument !== current && item.argument.startsWith(current);
					default:
						return true;
				}
			});
	};

	const output = (items) => shell(
		normalize(items)
			.reduce((grouped, item) => {

				grouped[item.type] = grouped[item.type] || [];

				switch (item.type) {
					case 'option':
						// fall through
					case 'command':
						grouped[item.type].push(item);
						break;
					default:
				}

				return grouped;

			}, {}));

	const argumentsParser = (
		{
			args = process.argv.slice(shell.argsOffset || 3),
			argvLevel = 0,
			placeholder = '<>',
			command,
			onCommand,
			onParameter,
			options = {
				schema: {},
				data: {},
				validationOptions: {}
			},
			parameters = {}
		} = {}
	) => {

		const base = `${process.argv.slice(1, argvLevel + 2).map(((arg) => basename(arg))).join(' ')}`;

		const next = async (identifier, command) => {

			return await command({
				args: args.slice(1),
				argumentsParser: argumentsParser({
					args: args.slice(1),
					argvLevel: argvLevel + 1,
					onCommand,
					onParameter,
					placeholder,
					command: command,
					options,
					parameters
				}),
				parameters
			});

		};

		const result = {
			get base() {
				return base;
			},
			command: async (commands) => {

				const tool = caseit(args[0] || '');

				if (commands[tool]) {

					onCommand?.(tool, args.slice(1));

					return await next(
						tool,
						commands[tool]);

				}

				return output(Object.keys(commands)
					.filter((command) => command.startsWith(tool))
					.map((command) => ({
						type: 'command',
						argument: caseit(command, 'kebab'),
						description: commands[command].description
					})));

			},
			parameter: async ({
				identifier,
				autocomplete
			}, command) => {

				const available = filter(await autocomplete?.(args[0] || '') || []);

				if (available.length) {
					return output(available);
				}

				parameters[identifier] = args[0];

				(onParameter || onCommand)?.(identifier, args.slice(1));

				return await next(
					identifier,
					command);

			},
			options: (schema, validationOptions = {}) => {

				validationOptions.command = validationOptions.command || command;

				Object.assign(
					options.validationOptions,
					validationOptions);

				options.schema = merge(
					schema, {
						transform: {
							post: (key, validator) => {
								if (key === 'enum') {
									return validator.map((value) => caseit(value, 'kebab'));
								}
							}
						}
					})
					.with(options.schema);

				return result;

			},
			then: (
				...resultArguments
			) => {
				return (async () => {

					const {
						variadic,
						autocomplete = () => [{
							type: 'files'
						}]
					} = options.validationOptions;

					const allKeyPaths = keyPaths(options.schema)
						.all()
						.filter((keyPath) => keyPath);

					let idx;
					let schemas = {};
					let spent = [];

					const complete = async (idx, current = '') => {

						let key = current;

						while (key.startsWith('-')) {
							key = key.slice(1);
						}

						key = caseit(key);

						if (schemas[idx]) {

							if (schemas[idx].enum) {
								return Object.keys(schemas[idx].enum)
									.filter((item) => caseit(key, 'kebab') !== item && item.startsWith(current))
									.map((item) => ({
										type: 'option',
										argument: caseit(item, 'kebab')
									}));
							}

							if (schemas[idx].type === String && !schemas[idx].autocomplete) {
								return [{
									type: 'files'
								}];
							}

							return filter(await schemas[idx].autocomplete?.(current) || []);

						} else {

							let items = [];

							if (!current.startsWith('--')) {

								if (!current.startsWith('-')) {
									if (variadic === 'allow') {
										items = items.concat(
											filter(await autocomplete?.(current) || []));
									}
								}

								items = items.concat(
									allKeyPaths
										.filter((keyPath) => !spent.includes(keyPath))
										.filter((keyPath) => key !== keyPath && keyPath.startsWith(key) && keyPaths(options.schema).get(keyPath).short)
										.map((keyPath) => ({
											type: 'option',
											argument: `-${caseit(keyPaths(options.schema).get(keyPath).short, 'kebab')}`,
											description: keyPaths(options.schema).get(keyPath).description
										})));

							}

							items = items.concat(
								allKeyPaths
									.filter((keyPath) => !spent.includes(keyPath))
									.filter((keyPath) => key !== keyPath && keyPath.startsWith(key))
									.map((keyPath) => ({
										type: 'option',
										argument: `--${caseit(keyPath, 'kebab')}`,
										description: keyPaths(options.schema).get(keyPath).description
									})));

							return items;

						}

					};

					if (args.length === 0) {
						return output(
							await complete(-1));
					}

					for (idx = 0; idx < args.length; idx++) {

						if (!schemas[idx]) {

							if (!args[idx].startsWith('-')) {
								return output(
									await complete(idx, args[idx]));
							}

							const [keyPath, schema] = allKeyPaths
								.filter((keyPath) => !spent.includes(keyPath))
								.map((keyPath) => [keyPath, keyPaths(options.schema).get(keyPath)])
								.filter(([keyPath, schema]) => keyPath === args[idx] || `--${caseit(keyPath, 'kebab')}` === args[idx] || (schema.short && `-${schema.short}` === args[idx]))[0] || [];

							spent.push(keyPath);

							if (schema && schema.type !== Boolean) {
								schemas[idx + 1] = schema;
							}

						}

					}

					const current = await complete(idx - 1, args[idx - 1]);

					if (current.length) {
						return output(current);
					}

					return output(
						await complete(idx));


				})().then(...resultArguments);
			}
		};

		return result;

	};

	return argumentsParser;

};

export default argumentsParser;
