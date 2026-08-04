//
// zsh.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2026/08/02
// See license in LICENSE.
//

import {
	basename,
	extname
} from 'path';

const zsh = (items) => {

	const keys = Object.keys(items);

	if (keys.length === 0) {
		process.exit(0);
	}

	keys
		.forEach((key) => {

			switch (key) {
				case 'command':
					// fall through
				case 'option':

					process.stdout.write(`_describe '${key}s' '(\n`);

					items[key]
						.forEach((item) => {

							const parts = [item.argument, item.description]
								.filter((part) => part)
								.map((part) => ['"', '\\', '$', '`']
									.reduce((part, char) => part.replaceAll(char, `\\${char}`), part));

							process.stdout.write(`  "${parts.join(':')}"\n`);

						});

					process.stdout.write(')\'\n');

					break;
				case 'files':
					process.stdout.write('_files\n');
					return;
			}

		});

	process.exit(0);

};

zsh.script = ({
	command
}) => `#compdef ${command}

_${command}() {
	eval "$(AUTOCOMPLETE=zsh AUTOCOMPLETE_CURRENT=$CURRENT ${command} "\${words[@]}")"
}

_${command}`;

export default zsh;
