//
// index.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2023/08/07
// See license in LICENSE.
//

import { basename } from 'path';

import caseit from '@trenskow/caseit';
import { default as isvalid, keyPaths, formalize, plugins } from 'isvalid';
import print from '@trenskow/print';

plugins.use(() => ({
	phase: 'pre',
	supportsType: () => true,
	validatorsForType: () => ({
		description: ['string'],
		defaultDescription: ['string'],
		secret: ['boolean'],
		short: ['string'],
	}),
	validate: (data) => data,
	formalize: (schema) => schema
}));

const argumentsParser = (
	{
		args = process.argv.slice(2),
		argvLevel = 0,
		placeholder = '<>',
		command,
		strings = {},
		help: {
			usage: helpUsage,
			options: helpOptions,
		} = {}
	} = {}
) => {

	const [ opening, closing ] = placeholder.split('');

	const base = `${process.argv.slice(1, argvLevel + 2).map(((arg) => basename(arg))).join(' ')}`;

	const list = (print, items, spacing = false) => {

		const maxLength = Object.keys(items)
			.reduce((length, key) => Math.max(length, key.length), 0);

		Object.entries(items)
			.forEach(([key, description], idx) => {

				if (spacing && idx > 0) print();

				print.nn(`  ${key}`, { minimumLength: maxLength + 4 });

				if (!Array.isArray(description)) description = [description];

				description
					.forEach((description, idx) => {

						if (idx > 0) {
							print.nn('', { minimumLength: maxLength + 4 });
						}

						print.sentence(description);

					});

			});

	};

	if (typeof helpUsage === 'undefined') {
		helpUsage = [
			strings?.help?.usage || 'Usage:',
			base
		];
	}

	const printHelp = (error) => {

		print();

		print(helpUsage.join(' '));

		if (helpOptions) {
			print.nn(helpOptions());
		}

		if (error) {
			print();
			print.bold((strings?.commands?.help?.error || 'Error: <message>')
				.replace('<message>', error.message));
		}

		print();

		process.exit(error ? 1 : 0);

	};

	const checkHelp = () => {
		if (args[0] === '--help') printHelp();
	};

	return {
		get base() {
			return base;
		},
		command: async (commands) => {

			helpUsage.push(`${opening}${strings?.commands?.help?.placeholder || 'command'}${closing}`);

			helpOptions = () => {

				print();
				print(strings?.commands?.help?.available || 'Available commands:');
				print();

				const tools = Object.keys(commands).map((key) => ({
					name: caseit(key, 'kebab'),
					description: commands[key].description
				}));

				tools.sort((a, b) => a.name > b.name ? 1 : -1);

				list(print, Object.fromEntries(tools
					.map((tool) => [tool.name, tool.description || (strings?.commands?.help?.noDescription || 'No description')])));

			};

			if (args.length === 0) printHelp();

			checkHelp();

			const tool = caseit(args[0]);

			if (!commands[tool]) {
				printHelp(
					new Error(
						(strings?.commands?.help?.errors?.notFound || '<command>: Command not found')
							.replace('<command>', args[0])));
			}

			try {

				return await commands[tool]({
					args: args.slice(1),
					argumentsParser: argumentsParser({
						args: args.slice(1),
						argvLevel: argvLevel + 1,
						placeholder,
						command: commands[tool],
						strings
					})
				});

			} catch (error) {
				print.err(`${error.stack}`);
				process.exit(1);
			}

		},
		options: async (schema, options = { }) => {

			options.command = options.command || command;

			schema = formalize(schema);

			let nonOptions;
			let nonOptionsIndex = args.indexOf('--');

			if (nonOptionsIndex > -1) {
				nonOptions = args.slice(nonOptionsIndex + 1).join(' ');
				args = args.slice(0, nonOptionsIndex);
			}

			const allKeyPaths = keyPaths(schema)
				.all()
				.filter((keyPath) => keyPath);

			helpUsage.push(`${opening}${strings?.options?.help?.placeholder || 'options'}${closing}`);

			let shortOptions = {};

			allKeyPaths
				.forEach((keyPath) => {

					const keyPathSchema = keyPaths(schema).get(keyPath);

					if (keyPathSchema.short) {

						if (shortOptions[keyPathSchema.short]) {
							throw new Error(`Short option "${keyPathSchema.short}" already used.`);
						}

						shortOptions[keyPath] = keyPathSchema.short;

					}

				});

			if (allKeyPaths.length) {

				helpOptions = () => {

					print();
					print(strings?.options?.help?.title || 'Options:');
					print();

					list(print, Object.fromEntries(allKeyPaths
						.map((keyPath) => {

							const keyPathSchema = keyPaths(schema).get(keyPath);

							let optionKeys = [`--${caseit(keyPath, 'kebab')}`];
							let description = [keyPathSchema.description || 'No description'];

							if (shortOptions[keyPath]) {
								optionKeys.push(`-${shortOptions[keyPath]}`);
							}

							if (typeof keyPathSchema.enum !== 'undefined') {
								description.push(`(${opening}${keyPath}${closing}: ${Object.keys(keyPathSchema.enum).map((value) => `\`${value}\``).join(', ')})`);
							}

							if (keyPathSchema.type === Array) {
								description.push(`${strings?.options?.help?.allowsMultple || '(allows multiple)'}`);
							} else if (keyPathSchema.required === true) {
								description.push(`${strings?.options?.help?.required || '(required)'}`);
							} else if (typeof keyPathSchema.default !== 'undefined') {

								let defaultDescription;

								if (keyPathSchema.secret === true) {
									defaultDescription = '`********`';
								} else {

									if (keyPathSchema.type === Boolean) {
										defaultDescription = keyPathSchema.default === true ? 'enabled' : 'disabled';
									} else {
										defaultDescription = `\`${keyPathSchema.defaultDescription ?? keyPathSchema.default}\``;
									}

								}

								description.push(`${(strings?.options?.help?.default || '(default: <default>)')
									.replace('<default>', defaultDescription)}`);

							}

							let option = optionKeys.reverse().join(', ');

							if (keyPathSchema.type !== Boolean) {
								option += ` ${strings?.options?.help?.argument || `${opening}${caseit(keyPath, 'kebab')}${closing}`}`;
							}

							return [option, description];

						})), true);

				};
			}

			checkHelp();

			let data = {};
			let rest = [];

			let idx;

			for (idx = 0 ; idx < args.length ; idx++) {

				if (args[idx].slice(0, 1) !== '-') {
					rest.push(args[idx]);
					continue;
				}

				shortOptions = Object.fromEntries(
					Object.entries(shortOptions)
						.map(([key, value]) => [value, key]));

				let key = args[idx].slice(1);

				if (args[idx].slice(1, 2) === '-') {
					key = caseit(args[idx].slice(2));
				} else if (shortOptions[key]) {
					key = caseit(shortOptions[key]);
				}

				if (!keyPaths(schema).all().includes(key)) {
					printHelp(
						new Error(
							(strings?.options?.help?.errors?.unknownOption || 'Unknown option: <option>.')
								.replace('<option>', args[idx])));
				}

				let value;

				if (keyPaths(schema).get(key).type === Boolean) {
					value = true;
				} else {
					if (args.length <= idx + 1 || args[idx + 1].slice(0, 2) === '--') {
						printHelp(
							new Error(
								(strings?.options?.help?.errors?.missingArgument || 'Argument missing for option: <option>.')
									.replace('<option>', args[idx])));
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

			if (rest.length) {
				switch (options.variadic || 'deny') {
					case 'allow':
						break;
					case 'ignore':
						rest = [];
						break;
					default:
						printHelp(
							new Error(
								(strings?.empty?.help?.errors?.unexpected || 'Unexpected argument: <argument>.')
									.replace('<argument>', args[0])));
				}
			}

			try {
				data = await isvalid(data, schema, {
					aggregatedErrors: 'flatten'
				});
			} catch (error) {
				let message = error.message;
				if (error.keyPath?.[0]) {
					message = `${caseit(error.keyPath[0], 'kebab')}: ${message}`;
				}
				printHelp(new Error(message));
			}

			return Object.assign({}, data, {
				onError: (error) => {
					print.err(error.message);
					process.exit(1);
				},
				rest,
				nonOptions
			});

		},
		empty: async () => {

			checkHelp();

			if (args.length > 0) {
				printHelp(
					new Error(
						(strings?.empty?.help?.errors?.unexpected || 'Unexpected argument: <argument>.')
							.replace('<argument>', args[0])));
			}

		},
		values: async (schema) => {

			schema = formalize(schema);

			if (schema.type !== Object) {
				throw new Error('Schema must be an object.');
			}

			const schemaKeyPaths = keyPaths(schema);

			const allKeyPaths = schemaKeyPaths.all({ maxDepth: 2 })
				.filter((keyPath) => keyPath);

			let lastNonRequiredIndex = -1;

			allKeyPaths
				.forEach((keyPath, idx) => {

					const schema = schemaKeyPaths.get(keyPath);

					if (schema.required && idx > lastNonRequiredIndex + 1) {
						throw new Error('Required arguments must come first.');
					}

					if (schema.type !== String) {
						throw new Error('Schema must be an object of strings.');
					}

					helpUsage = helpUsage.concat([`${opening}${caseit(keyPath, 'kebab')}${closing}`]);

				});

			checkHelp();

			try {
				return await isvalid(Object.fromEntries(
					allKeyPaths.map((keyPath, idx) => [keyPath, args[idx]])), schema);
			} catch (error) {
				return printHelp(error);
			}

		}
	};

};

export default argumentsParser;
