//
// zsh.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2026/08/02
// See license in LICENSE.
//

import caseit from '@trenskow/caseit';

const zsh = (items) => {

	if (items.length === 0) {
		process.exit(0);
	}

	process.stdout.write('_describe \'commands\' \'(\n');

	items
		.forEach((command) => {

			if (typeof command === 'string') {
				process.stdout.write(`  "${command}"\n`);
				return;
			}

			process.stdout.write(`  "${command.prefix || ''}${command.command}:${(command.description || '').replaceAll('`', '\\`')}"\n`);

		});

	process.stdout.write(')\'\n');

	process.exit(0);

};

zsh.argsOffset = 3;

export default zsh;
