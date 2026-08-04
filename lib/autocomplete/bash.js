//
// bash.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2026/08/03
// See license in LICENSE.
//

const bash = (items) => {

	const keys = Object.keys(items);

	if (keys.length === 0) {
		process.exit(0);
	}

	let options = [];
	let files = false;

	keys
		.forEach((key) => {

			switch (key) {
				case 'command':
					// fall through
				case 'option':

					options = options.concat(items[key]
						.map((item) => item.argument));

					break;
				case 'files':
					files = true;
					break;
			}

		});

	if (options.length > 0 || files) {
		process.stdout.write('COMPREPLY=()\n');
	}

	if (options.length > 0) {

		process.stdout.write('COMPREPLY+=(');

		options
			.forEach((option) => {
				process.stdout.write(`  "${['"', '\\', '$', '`']
					.reduce((option, char) => option.replaceAll(char, `\\${char}`), option)
				}" `);
			});

		process.stdout.write(')\n');

	}

	if (files) {
		process.stdout.write('COMPREPLY+=($(compgen -f -- "${COMP_WORDS[COMP_CWORD]}"))\n');
	}

	process.exit(0);

};

bash.script = ({
	command
}) => `_${command}() {
    eval "$(AUTOCOMPLETE=bash AUTOCOMPLETE_CURRENT=$COMP_CWORD ${command} "\${COMP_WORDS[@]}")"
}

complete -F _${command} ${command}`;

export default bash;
