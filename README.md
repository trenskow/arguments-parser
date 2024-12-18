# @trenskow/arguments-parser

Yet another arguments parser.

# Usage

````javascript
import argumentsParser from '@trenskow/arguments-parser';

const login = async (...args) => {

	const {
		username,
		password
	} = await argumentParser(args).options({
		username: {
			type: String,
			required: true,
			len: '1-',
			description: "Username of the user"
		},
		password: {
			type: String,
			required: true,
			len: '6-',
			description: "Password of the user"
		}
	}, { login });

	// Do login logic.

};

login.description = 'Logs in a user';

const message = async (...args) => {

	const {
		message
	} = await argumentParser(args).options({
		message: {
			type: String,
			default: 'Empty message',
			description: 'Message to send'
		}
	}, { message });

	// Do message logic.

};

message.description = 'Sends a message from a user.';

await argumentsParser(/* argv (default is `process.argv.slice(2)` */)
	.command({ login, message });
````

The above example will output.

````
# ./my-script
Usage: my-script [command]

Available commands:
	login    Logs in a user.
	message  Sends a message from a user.
# ./my-script login --help
Usage: my-script login [options]

Options:
	 --username  Username of the user.
	 --password  Password of the user.
# ./my-script message --help
Usage: my-script message [options]

Options:
	--message  Message to send (default: `Empty message`).

````

> The validation schema is described in package [isvalid](https://github.com/trenskow/isvalid).

# License

See license in LICENSE.
