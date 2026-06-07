//
// index.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2023/08/07
// See license in LICENSE.
//

import { basename } from 'path';

import caseit from '@trenskow/caseit';
import { default as isvalid, merge, keyPaths, plugins } from 'isvalid';
import print from '@trenskow/print';

plugins.use('argumentsParser.default', () => ({
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

plugins.use('argumentsParser.hints', () => ({
	phase: 'pre',
	supportsType: () => true,
	validatorsForType: () => ({
		hints: ['array', 'string']
	}),
	validate: (data) => data,
	formalize: (data, _, schema) => {
		if (!Array.isArray(data)) data = [data];
		if (schema.errors.hints) {
			data.push(schema.errors.hints);
			delete schema.errors.hints;
		}
		if (data.some((data) => typeof data !== 'string')) throw new Error('Must be a string.');
		return data;
	}
}));

const argumentsParser = (
	{
		args = process.argv.slice(2),
		argvLevel = 0,
		placeholder = '<>',
		command,
		onCommand,
		onParameter,
		strings = {},
		help: {
			usage: helpUsage,
			options: helpOptions,
		} = {},
		options = {
			schema: {},
			data: {},
			validationOptions: {}
		},
		parameters = {}
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

		if (command) {
			print.bold(command.description);
			print();
		}

		print(helpUsage.join(' '));

		if (helpOptions) {
			print.nn(helpOptions());
		}

		if (error) {

			print();

			(error.errors || [error])
				.forEach((error) => {

					let message = error.message;

					if (error.keyPath?.[0]) {
						message = `${caseit(error.keyPath[0], 'kebab')}: ${message}`;
					}

					print.bold((strings?.commands?.help?.error || 'Error: <message>')
						.replace('<message>', message));

				});

		}

		print();

		process.exit(error ? 1 : 0);

	};

	const checkHelp = () => {
		if (args[0] === '--help') printHelp();
	};

	const next = async (identifier, command) => {

		try {

			return await command({
				args: args.slice(1),
				argumentsParser: argumentsParser({
					args: args.slice(1),
					argvLevel: argvLevel + 1,
					onCommand,
					onParameter,
					placeholder,
					command: command,
					strings,
					options,
					parameters
				})
			});

		} catch (error) {
			print.err(`${error.stack}`);
			process.exit(1);
		}
	};

	const result = {
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

			onCommand?.(tool, args.slice(1));

			return await next(
				tool,
				commands[tool]);

		},
		parameter: async ({
			identifier,
			description,
			schema
		} = {}, command) => {

			if (typeof identifier !== 'string') {
				throw new Error('Identifier must be a string');
			}

			description = description || command.description || strings?.commands?.help?.noDescription || 'No description.';

			helpUsage.push(`${opening}${caseit(identifier, 'kebab')}${closing}`);

			helpOptions = () => {

				print();
				print(strings?.commands?.help?.available || 'Available commands:');
				print();

				list(print, {
					[`${opening}${caseit(identifier, 'kebab')}${closing}`]: description
				});

			};

			if (args.length === 0) printHelp();

			checkHelp();

			parameters[identifier] = args[0];

			try {
				if (typeof schema !== 'undefined') {
					parameters[identifier] = await isvalid(
						parameters[identifier],
						schema);
				}
			} catch (error) {
				printHelp(error);
			}

			(onParameter || onCommand)?.(identifier, args.slice(1));

			return await next(
				identifier,
				command);

		},
		options: (schema, validationOptions = { }) => {

			validationOptions.command = validationOptions.command || command;

			Object.assign(
				options.validationOptions,
				validationOptions);

			options.schema = merge(
				options.schema)
				.with(schema);

			return result;

		},
		help(error) {
			printHelp(error);
		},
		then: (...resultArguments) => {
			return (async () => {

				checkHelp();

				let nonOptions;
				let nonOptionsIndex = args.indexOf('--');

				if (nonOptionsIndex > -1) {
					nonOptions = args.slice(nonOptionsIndex + 1).join(' ');
					args = args.slice(0, nonOptionsIndex);
				}

				const allKeyPaths = keyPaths(options.schema)
					.all()
					.filter((keyPath) => keyPath);

				if (allKeyPaths.length) {
					helpUsage.push(`${opening}${strings?.options?.help?.placeholder || 'options'}${closing}`);
				}

				if (typeof options.validationOptions.usage === 'string') {
					helpUsage.push(options.validationOptions.usage);
				}

				let shortOptions = {};

				allKeyPaths
					.forEach((keyPath) => {

						const keyPathSchema = keyPaths(options.schema).get(keyPath);

						if (keyPathSchema.short) {

							if (shortOptions[keyPathSchema.short]) {
								throw new Error(`Short option "${keyPathSchema.short}" already used.`);
							}

							shortOptions[keyPath] = keyPathSchema.short;

						}

					});

				shortOptions = Object.fromEntries(
					Object.entries(shortOptions)
						.map(([key, value]) => [value, key]));

				if (allKeyPaths.length) {

					helpOptions = () => {

						print();
						print(strings?.options?.help?.title || 'Options:');
						print();

						list(print, Object.fromEntries(allKeyPaths
							.map((keyPath) => {

								const keyPathSchema = keyPaths(options.schema).get(keyPath);

								let optionKeys = [`--${caseit(keyPath, 'kebab')}`];
								let description = [keyPathSchema.description || strings?.commands?.help?.noDescription || 'No description'];

								if (shortOptions[keyPath]) {
									optionKeys.push(`-${shortOptions[keyPath]}`);
								}

								if (typeof keyPathSchema.enum !== 'undefined') {
									description.push(`(${opening}${keyPath}${closing}: ${Object.keys(keyPathSchema.enum).map((value) => `\`${value}\``).join(', ')})`);
								}

								if (keyPathSchema.type === Array) {
									description.push(`${strings?.options?.help?.allowsMultiple || '(allows multiple)'}`);
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

								if (keyPathSchema.hints?.length) {
									description = description.concat(keyPathSchema.hints);
								}

								let option = optionKeys.reverse().join(', ');

								if (keyPathSchema.type !== Boolean) {
									option += ` ${strings?.options?.help?.argument || `${opening}${caseit(keyPath, 'kebab')}${closing}`}`;
								}

								return [option, description];

							})), true);

					};
				}

				let rest = [];

				let idx;

				for (idx = 0 ; idx < args.length ; idx++) {

					if (args[idx].slice(0, 1) !== '-') {
						rest.push(args[idx]);
						continue;
					}

					let key = args[idx].slice(1);

					if (args[idx].slice(1, 2) === '-') {
						key = caseit(args[idx].slice(2));
					} else if (shortOptions[key]) {
						key = caseit(shortOptions[key]);
					}

					if (!keyPaths(options.schema).all().includes(key)) {
						printHelp(
							new Error(
								(strings?.options?.help?.errors?.unknownOption || 'Unknown option: <option>.')
									.replace('<option>', args[idx])));
					}

					let value;

					if (keyPaths(options.schema).get(key).type === Boolean) {
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

					if (typeof options.data[key] === 'undefined') {
						options.data[key] = value;
					} else if (Array.isArray(options.data[key])) {
						options.data[key].push(value);
					} else {
						options.data[key] = [options.data[key], value];
					}

				}

				if (rest.length) {
					switch (options.validationOptions.variadic || 'deny') {
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

				if (args.length > 0) {
					printHelp(
						new Error(
							(strings?.empty?.help?.errors?.unexpected || 'Unexpected argument: <argument>.')
								.replace('<argument>', args[0])));
				}

				let data = {};

				try {
					data = await isvalid(options.data, options.schema, {
						aggregatedErrors: 'flatten'
					});
				} catch (error) {
					printHelp(error);
				}

				return Object.assign({}, parameters, data, {
					onError: (error) => {
						print.err(error.message);
						process.exit(1);
					},
					rest,
					nonOptions
				});

			})().then(...resultArguments);
		}
	};

	return result;

};

export default argumentsParser;
