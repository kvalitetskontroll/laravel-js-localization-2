(function() {
    var locale;
    var messages = {};

    var intervalRegexp = /^({\s*(\-?\d+(\.\d+)?[\s*,\s*\-?\d+(\.\d+)?]*)\s*})|([\[\]])\s*(-Inf|\*|\-?\d+(\.\d+)?)\s*,\s*(\+?Inf|\*|\-?\d+(\.\d+)?)\s*([\[\]])$/;
    var anyIntervalRegexp = /({\s*(\-?\d+(\.\d+)?[\s*,\s*\-?\d+(\.\d+)?]*)\s*})|([\[\]])\s*(-Inf|\*|\-?\d+(\.\d+)?)\s*,\s*(\+?Inf|\*|\-?\d+(\.\d+)?)\s*([\[\]])/;

    /* Utility functions: */

    /**
     * Replace variables used in the message by appropriate values.
     *
     * @method applyReplacements
     * @static
     * @param {String} message      Input message.
     * @param {Object} replacements Associative array: { variableName: "replacement", ... }
     * @return {String} The input message with all replacements applied.
     */
    var applyReplacements = function(message, replacements) {
        for (var replacementName in replacements) {
            var replacement = String(replacements[replacementName]);

            // 'welcome' => 'Welcome, :name' => 'Welcome, dayle'
            message = message.replace(
                new RegExp(':' + replacementName, 'g'),
                replacement,
            );
            // 'welcome' => 'Welcome, :NAME' => 'Welcome, DAYLE'
            message = message.replace(
                new RegExp(':' + replacementName.toUpperCase(), 'g'),
                replacement.toUpperCase(),
            );
            // 'welcome' => 'Welcome, :Name' => 'Welcome, Dayle'
            message = message.replace(
                new RegExp(':' + (replacementName.charAt(0).toUpperCase() + replacementName.substr(1)), 'g'),
                replacement.charAt(0).toUpperCase() + replacement.substr(1),
            );
        }

        return message;
    };

    var isEmpty = function(obj) {
        for (var prop in obj) {
            if (Object.hasOwnProperty.call(obj, prop))
                return false;
        }

        return true;
    };

    var convertNumber = function(str) {
        if (str === '-Inf') {
            return -Infinity;
        } else if (str === '+Inf' || str === 'Inf' || str === '*') {
            return Infinity;
        }

        return parseInt(str, 10);
    };

    /* Lang: */

    /**
     * Lang class. Works similar to the Laravel Lang object.
     * @class Lang
     */

    var Lang = {

        /**
         * Translate a message.
         *
         * @method get
         * @static
         * @param {String} messageKey       The message key (message identifier).
         * @param {Object} [replacements]   Associative array: { variableName: "replacement", ... }
         * @return {String} Translated message.
         */
        get: function(messageKey, replacements, forceLocale) {
            var uselocale = locale;

            if (forceLocale) {
                uselocale = forceLocale;
            }

            if (typeof messages[uselocale][messageKey] == 'undefined') {
                /* like Lang::get(), if messageKey is the name of a lang file, return it as an array */
                var result = {};

                for (var prop in messages[uselocale]) {
                    if (prop.indexOf(messageKey + '.') > -1) {
                        result[prop] = messages[uselocale][prop];
                    }
                };

                if (!isEmpty(result)) {
                    return result;
                }

                /* if there is nothing to return, return messageKey */
                return messageKey;
            }

            var message = messages[uselocale][messageKey];

            if (replacements) {
                message = applyReplacements(message, replacements);
            }

            return message;
        },

        /**
         * Returns whether the given message is defined or not.
         *
         * @method has
         * @static
         * @param {String} messageKey   Message key.
         * @return {Boolean} True if the given message exists.
         */
        has: function(messageKey) {
            return typeof messages[locale][messageKey] != 'undefined';
        },

        _testInterval: function(count, interval) {
            if (typeof interval !== 'string') {
                throw 'Invalid interval: should be a string.';
            }

            interval = interval.trim();

            var matches = interval.match(intervalRegexp);

            if (!matches) {
                throw 'Invalid interval: ' + interval;
            }

            if (matches[2]) {
                var items = matches[2].split(',');

                for (var i = 0; i < items.length; i++) {
                    if (parseInt(items[i], 10) === count) {
                        return true;
                    }
                }
            } else {
                // Remove falsy values.
                matches = matches.filter(function(match) {
                    return !!match;
                });

                var leftDelimiter = matches[1];
                var leftNumber = convertNumber(matches[2]);

                if (leftNumber === Infinity) {
                    leftNumber = -Infinity;
                }

                var rightNumber = convertNumber(matches[3]);
                var rightDelimiter = matches[4];

                return (leftDelimiter === '[' ? count >= leftNumber : count > leftNumber)
                    && (rightDelimiter === ']' ? count <= rightNumber : count < rightNumber);
            }

            return false;
        },

        /**
         * Choose one of multiple message versions, based on
         * pluralization rules. Only English pluralization
         * supported for now. If `count` is one then the first
         * version of the message is retuned, otherwise the
         * second version.
         *
         * @method choice
         * @static
         * @param {String} messageKey       Message key.
         * @param {Integer} count           Subject count for pluralization.
         * @param {Object} [replacements]   Associative array: { variableName: "replacement", ... }
         * @return {String} Translated message.
         */
        choice: function(messageKey, count, replacements) {
            if (typeof messages[locale][messageKey] == 'undefined') {
                return messageKey;
            }

            var message = messages[locale][messageKey];
            var messageParts = message.split('|');

            // Get the explicit rules, If any
            var explicitRules = [];

            for (var i = 0; i < messageParts.length; i++) {
                messageParts[i] = messageParts[i].trim();

                if (anyIntervalRegexp.test(messageParts[i])) {
                    var messageSpaceSplit = messageParts[i].split(/\s/);
                    explicitRules.push(messageSpaceSplit.shift());
                    messageParts[i] = messageSpaceSplit.join(' ');
                }
            }

            // Check if there's only one message
            if (messageParts.length === 1) {
                // Nothing to do here
                return applyReplacements(message, replacements);
            }

            // Check the explicit rules
            for (var j = 0; j < explicitRules.length; j++) {
                if (this._testInterval(count, explicitRules[j])) {
                    return applyReplacements(messageParts[j], replacements);
                }
            }

            return applyReplacements(messageParts[count == 1 ? 0 : 1], replacements);
        },

        /**
         * Sets the current locale. Normally only used once
         * during initialization. The value comes from the backend.
         *
         * @method setLocale
         * @static
         * @param {String} localeId The locale returned by Laravel's Lang::locale().
         * @throws {Error} An error is thrown if messages[localeId] is not defined.
         */
        setLocale: function(localeId) {
            locale = localeId;

            if (!messages[localeId]) {
                throw new Error(
                    'No messages defined for locale: "' + localeId + '". '
                    + 'Did you forget to enable it in the configuration?',
                );
            }
        },

        /**
         * Returns the current locale.
         *
         * @method locale
         * @static
         * @return {String} The current locale.
         */
        locale: function() {
            return locale;
        },

        /**
         * Used to initialize the message catalog. You may use this
         * method to add further messages on runtime if necessary.
         *
         * @method addMessages
         * @static
         * @param {Object} _messages  An associative array: { messageKey: "message", ... }
         */
        addMessages: function(_messages) {
            for (var key in _messages) {
                messages[key] = _messages[key];
            }
        },
    };

    /* Export: */

    this.Lang = Lang;
    this.trans = Lang.get;
    this.transChoice = Lang.choice;
})();
