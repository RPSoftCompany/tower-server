//    Copyright RPSoft 2019,2020. All Rights Reserved.
//    This file is part of RPSoft Tower.
//
//    Tower is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation; either version 3 of the License, or
//    (at your option) any later version.
//
//    Tower is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with Tower.  If not, see <http://www.gnu.org/licenses/>.

const HttpErrors = require('http-errors');

module.exports = class BaseConfiguration {
    /**
     * Constructor
     *
     * @param {object} app APP
     */
    constructor(app) {
        this.configurationName = 'baseConfiguration';
        this.logger = null;

        this.app = app;
    }

    /**
     * logger
     *
     * @param {string} severity Severity
     * @param {string} method current method
     * @param {string} message Message to log
     * @param {string} obj object to log
     *
     */
    log(severity, method, message, obj) {
        if (this.logger === null) {
            this.logger = this.app.get('winston');
        }

        if (obj !== undefined) {
            this.logger.log(severity, `${this.configurationName}.${method} ${message}`, obj);
        } else {
            this.logger.log(severity, `${this.configurationName}.${method} ${message}`);
        }
    }

    /**
     * create base Configuration
     *
     * @param {baseConfiguration} baseConfig new base configuration
     *
     * @return {baseConfiguration} created model
     */
    async createBaseConfiguration(baseConfig) {
        this.log('debug', 'createBaseConfiguration', 'STARTED');

        if (baseConfig.name === 'version') {
            this.log('debug', 'createBaseConfiguration', 'FINISHED');
            throw new HttpErrors.BadRequest(`Configuration model can't be named 'version'`);
        }

        const baseConfiguration = this.app.models.baseConfiguration;
        // const role = this.app.models.Role;
        const all = await baseConfiguration.count();

        baseConfig.sequenceNumber = all;

        await baseConfig.save();

        this.log('debug', 'createBaseConfiguration', 'FINISHED');

        return baseConfig;
    }

    /**
     * change sequence of bases
     *
     * @param {baseConfiguration} baseConfig changed base config
     */
    async changeSequence(baseConfig) {
        this.log('debug', 'changeSequence', 'STARTED');

        const baseConfiguration = this.app.models.baseConfiguration;
        const all = await baseConfiguration.find({
            order: 'sequenceNumber ASC',
        });

        const tempArray = [];
        let newBase = null;

        for (const base of all) {
            if (baseConfig.name !== base.name) {
                tempArray.push(base);
            } else {
                base.sequenceNumber = baseConfig.sequenceNumber;
                newBase = base;
            }
        };

        tempArray.splice(baseConfig.sequenceNumber, 0, newBase);

        for (let i = 0; i < tempArray.length; i++) {
            const base = tempArray[i];

            base.sequenceNumber = i;
            await base.save();
        }

        this.log('debug', 'changeSequence', 'FINISHED');
    };

    /**
     * Delete base configuration
     *
     * @param {String} id id of base configuration to delete
     */
    async deleteBaseConfiguration(id) {
        this.log('debug', 'deleteBaseConfiguration', 'STARTED');

        const baseConfiguration = this.app.models.baseConfiguration;
        const role = this.app.models.Role;

        const base = await baseConfiguration.findOne({
            where: {
                id: id,
            },
        });

        const all = await baseConfiguration.find({
            order: 'sequenceNumber ASC',
        });

        for (let i = 0; i < all.length; i++) {
            const base = all[i];
            base.sequenceNumber = i;
            await base.save();
        };

        await role.deleteAll({
            name: {
                like: `${base.name}\.*`,
            },
        });

        await base.destroy();

        this.log('debug', 'deleteBaseConfiguration', 'FINISHED');
    };
};
