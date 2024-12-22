//
// index.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2023/08/07
// See license in LICENSE.
//

import { basename } from 'path';

import caseit from '@trenskow/caseit';
import { default as isvalid, keyPaths, formalize } from 'isvalid';
import print from '@trenskow/print';

const argumentsParser = ({ args = process.argv.slice(2), argvLevel = 0, placeholder = '<>' } = {}) => {

	const [ opening, closing ] = placeholder.split('');

	const base = `${process.argv.slice(1, argvLevel + 2).map(((arg) => basename(arg))).join(' ')}`;

	const list = (items) => {

		const maxLength = Object.keys(items)
			.reduce((length, key) => Math.max(length, key.length), 0);

		Object.entries(items)
			.forEach(([key, description]) => {
				print.nn(`  ${key}`, { minimumLength: maxLength + 4 });
				print.sentence(description);
			});

	};

	return {
		get base() {
			return base;
		},
		command: async (commands) => {

			const printHelp = (error) => {

				print();
				print(`Usage: ${base} ${opening}command${closing}`);
				print();
				print('Available commands:');
				print();

				const tools = Object.keys(commands).map((key) => ({
					name: caseit(key, 'kebab'),
					description: commands[key].description
				}));

				tools.sort((a, b) => a.name > b.name ? 1 : -1);

				list(Object.fromEntries(tools
					.map((tool) => [tool.name, tool.description || 'No description'])));

				if (error) {
					print();
					print();
					print(`Error: ${error.message}`);
				}

				print();

				process.exit(error ? 1 : 0);

			};

			if (args.length === 0) printHelp();

			const tool = caseit(args[0]);

			if (!commands[tool]) printHelp(new Error(`${args[0]}: Command not found.`));

			try {

				args = args.slice(1);
				argvLevel++;

				return await commands[tool]({ args, argumentsParser: argumentsParser({ args, argvLevel, placeholder }) });

			} catch (error) {
				print.err(`${error.stack}`);
				process.exit(1);
			}

		},
		options: async (schema, options = {}) => {

			schema = formalize(schema, {
				plugins: [() => ({
					phase: 'pre',
					supportsType: () => true,
					validatorsForType: () => ({
						description: ['string'],
						defaultDescription: ['string']
					}),
					validate: (data) => data,
					formalize: (schema) => schema
				})]
			});

			let nonOptions;
			let nonOptionsIndex = args.indexOf('--');

			if (nonOptionsIndex > -1) {
				nonOptions = args.slice(nonOptionsIndex + 1).join(' ');
				args = args.slice(0, nonOptionsIndex);
			}

			const allKeyPaths = keyPaths(schema)
				.all()
				.filter((keyPath) => keyPath);

			const printHelp = (error) => {

				if (typeof options?.cmd?.description === 'string') {
					print();
					print(options.cmd.description);
				}

				print();
				print.nn(`Usage: ${base} ${opening}options${closing}`);

				if (options.help?.postfix) print.nn(options.help.postfix);

				print();

				if (allKeyPaths.length) {

					print();
					print('Options:');

					list(Object.fromEntries(allKeyPaths
						.map((keyPath) => {

							const keyPathSchema = keyPaths(schema).get(keyPath);

							let description = keyPathSchema.description || 'No description';

							if (typeof keyPathSchema.enum !== 'undefined') {
								description += ` (${Object.keys(keyPathSchema.enum).map((value) => `\`${value}\``).join(', ')})`;
							}

							if (keyPathSchema.type === Array) {
								description += ' (allows multiple)';
							} else if (keyPathSchema.required === true) {
								description += ' (required)';
							} else if (typeof keyPathSchema.default !== 'undefined') {
								description += ' (default: ';
								if (keyPathSchema.type === Boolean) {
									description += keyPathSchema.default === true ? 'enabled' : 'disabled';
								} else {
									description += `\`${keyPathSchema.defaultDescription ?? keyPathSchema.default}\``;
								}
								description += ')';
							}
							description += '.';

							return [`--${caseit(keyPath, 'kebab')}`, description];

						})));

				}

				print();

				process.exit(error ? 1 : 0);

			};

			let data = {};
			let rest = [];

			let idx;

			for (idx = 0 ; idx < args.length ; idx++) {

				if (args[idx].slice(0, 2) !== '--') {
					rest.push(args[idx]);
					continue;
				}

				const arg = args[idx].slice(2);

				const key = caseit(arg);

				if (key === 'help') printHelp();

				if (!keyPaths(schema).all().includes(key)) printHelp(new Error(`Unknown option: ${args[idx]}.`));

				let value;

				if (keyPaths(schema).get(key).type === Boolean) {
					value = true;
				} else {
					if (args.length <= idx + 1 || args[idx + 1].slice(0, 2) === '--') {
						printHelp(new Error(`Argument missing for option: ${args[idx]}.`));
					}
					value = args[++idx];
				}

				if (typeof data[key] === 'undefined') {
					data[key] = value;
				} else if (Array.isArray(data[key])) {
					data[key].push(value);
				} else {
					data[key] = [data[key], value];
				}

			}

			try {
				data = await isvalid(data, schema, {
					stopAtFirstError: false
				});
			} catch (error) {
				printHelp(new Error(`--${caseit(error.keyPath.join('.'), 'kebab')}: ${error.message}`));
			}

			return Object.assign({}, data, {
				onError: (error) => {
					print.err(error.message);
					process.exit(1);
				},
				nonOptions,
				rest
			});

		}
	};

};

export default argumentsParser;
