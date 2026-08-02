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

import buildIns from './build-ins/index.js';

import zsh from './zsh.js';

const supported = {
	zsh
};

const argumentsParser = (output) => {

	output = supported[output];

	if (!output) return undefined;

	const argumentsParser = (
		{
			args = process.argv.slice(output.argsOffset || 2),
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
						command,
						description: commands[command].description
					})));

			},
			parameter: async ({
				identifier,
				autocomplete
			}, command) => {

				const available = (await autocomplete?.(args[0] || '') || [])
					.filter((item) => item !== args[0] && item.startsWith(args[0] || ''));

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
						autocomplete = buildIns.files
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
									.map((item) => caseit(item, 'kebab'));
							}

							if (schemas[idx].type === String && !schemas[idx].autocomplete) {
								return await (buildIns.files(
									current))
									.filter((item) => key !== item && item.startsWith(current));
							}

							return (await schemas[idx].autocomplete?.(current) || [])
								.filter((item) => key !== item && item.startsWith(current));

						} else {

							let items = [];

							if (!current.startsWith('--')) {

								if (!current.startsWith('-')) {
									if (variadic === 'allow') {
										items = items.concat(
											(await autocomplete?.(current) || [])
												.filter((item) => current !== item && item.startsWith(current)));
									}
								}

								items = items.concat(
									allKeyPaths
										.filter((keyPath) => !spent.includes(keyPath))
										.filter((keyPath) => key !== keyPath && keyPath.startsWith(key) && keyPaths(options.schema).get(keyPath).short)
										.map((keyPath) => ({
											command: caseit(keyPaths(options.schema).get(keyPath).short, 'kebab'),
											description: keyPaths(options.schema).get(keyPath).description,
											prefix: '-'
										})));

							}

							items = items.concat(
								allKeyPaths
									.filter((keyPath) => !spent.includes(keyPath))
									.filter((keyPath) => key !== keyPath && keyPath.startsWith(key))
									.map((keyPath) => ({
										command: caseit(keyPath, 'kebab'),
										description: keyPaths(options.schema).get(keyPath).description,
										prefix: '--'
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
export * as buildIns from './build-ins/index.js';
