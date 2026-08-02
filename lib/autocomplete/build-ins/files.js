//
// files.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2026/08/02
// See license in LICENSE.
//

import {
	join,
	resolve
} from 'path';

import {
	stat,
	readdir
} from 'fs/promises';

import parallel from '@trenskow/parallel';

const safeStat = async (path) => {
	try {
		return await stat(path);
	} catch (_) {
		return undefined;
	}
};

export default async (current = '') => {

	if (current === '') {
		return await parallel(((await readdir(process.cwd()))
			.filter((file) => !file.startsWith('.')))
			.map(async (file) => `${file}${(await safeStat(resolve(process.cwd(), file)))?.isDirectory() ? '/' : ''}`));
	}

	const stat = await safeStat(
		resolve(
			process.cwd(),
			current));

	if (stat?.isDirectory()) {

		current = current.endsWith('/') ? current : `${current}/`;

		return (await parallel((await readdir(
			resolve(
				process.cwd(),
				current)))
			.map(async (file) => {

				if ((await safeStat(resolve(process.cwd(), current, file)))?.isDirectory()) {
					return `${file}/`;
				}

				return file;

			})))
			.filter((file) => !file.startsWith('.'))
			.map((file) => `${current}${file}`);

	} else if (stat) {
		return [];
	}

	return await parallel(((await readdir(join(current, '../')))
		.filter((file) => !file.startsWith('.'))
		.map((file) => join(current, '../', file)))
		.map(async (file) => (await safeStat(file))?.isDirectory() ? `${file}/` : file));

};
