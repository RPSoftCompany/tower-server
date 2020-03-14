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
const ConfigurationModelClass = require('./configurationModel.js');
const crypto = require('crypto');

module.exports = class Configuration {
    /**
     * Constructor
     *
     * @param {object} app APP
     */
    constructor(app) {
        this.configurationName = 'configuration';
        this.logger = null;

        // Crypto
        this.cryptr = null;

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
     * Creates crypto
     */
    async createCrypt() {
        if (this.cryptr === null) {
            // const v1 = this.app.models.v1;
            // const boot = await v1.findOne({
            //     where: {
            //         booted: true,
            //     },
            // });

            // // this.cryptr = new SimpleCrypto(boot.salt);
            // let salt = boot.salt;
            // salt = salt.match(/.{1,20}/g).reverse().join('');
            // salt = salt.match(/.{1,20}/g).reverse().join('');
            // this.cryptr = salt;

            if (this.app.secret === undefined) {
                throw new HttpErrors.BadRequest(`Secret not initialized`);
            }

            this.cryptr = this.app.secret;
        };
    }

    /**
     * Initialize secret
     *
     * @param {string} secret text, which will be used to encrypt/decrypt passwords
     *
     */
    async initializeSecret(secret) {
        this.log('debug', 'initializeSecret', 'STARTED');

        const v1 = this.app.models.v1;
        const boot = await v1.findOne({
            where: {
                booted: true,
            },
        });

        if (secret.length !== 32) {
            this.log('debug', 'initializeSecret', 'FINISHED');
            throw new HttpErrors.BadRequest(`Encryption key must have length of 32 characters`);
        }

        this.app.secret = secret.toString('base64');
        this.createCrypt();

        if (boot.encryptionCheck === undefined) {
            const pass = this.encryptPassword('encryptionCheck');
            boot.encryptionCheck = pass;
            await boot.save();
            this.log('debug', 'initializeSecret', 'FINISHED');
        } else {
            try {
                this.decryptPassword(boot.encryptionCheck);
            } catch ( e ) {
                this.app.secret = undefined;
                this.cryptr = null;

                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.log('debug', 'initializeSecret', 'FINISHED');
                throw new HttpErrors.BadRequest(`Invalid secret`);
            }
            this.log('debug', 'initializeSecret', 'FINISHED');
        }
    }

    /**
     * Encrypt password
     *
     * @param {string} password password to encrypt
     *
     * @return {string} encrypted password
     */
    encryptPassword(password) {
        let iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.cryptr), Buffer.from(iv, 'hex'));
        let encrypted = cipher.update(password);

        encrypted = Buffer.concat([encrypted, cipher.final()]);

        iv = iv.toString('hex').split('').reverse().join('');

        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    /**
     * Decrypt password
     *
     * @param {string} password password to decrypt
     *
     * @return {string} decrypted password
     */
    decryptPassword(password) {
        const textParts = password.split(':');
        const ivText = textParts.shift().split('').reverse().join('');
        const iv = Buffer.from(ivText, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.cryptr), iv);
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    }

    /**
     * Find configuration
     *
     * @param {any} filter query filter
     * @param {object} options request options
     *
     * @return {[configuration]} queried models
     */
    async findWithPermissions(filter, options) {
        this.log('debug', 'findWithPermissions', 'STARTED');

        const configuration = this.app.models.configuration;
        const baseConfiguration = this.app.models.baseConfiguration;
        const configModel = new ConfigurationModelClass(this.app);

        const configAll = await configuration.find(filter);
        const allBases = await baseConfiguration.find();

        await this.createCrypt();

        const findArray = [];
        const cache = new Map();

        for (const config of configAll) {
            let hasPermissions = true;

            for (const base of allBases) {
                const modelName = config[base.name];
                if (modelName !== undefined) {
                    let modelFind = null;
                    const temp = cache.get(`base.${base.name}"name.${modelName}`);
                    if (temp !== undefined) {
                        modelFind = temp;
                    } else {
                        modelFind = await configModel.findWithPermissions({
                            where: {
                                base: base.name,
                                name: modelName,
                            },
                        }, options);

                        cache.set(`base.${base.name}"name.${modelName}`, modelFind);
                    }

                    if (modelFind.length === 0) {
                        hasPermissions = false;
                    }
                }
            }

            if (hasPermissions) {
                config.variables.map((variable) => {
                    if (variable.type === 'password') {
                        variable.value = this.decryptPassword(variable.value);
                    }
                });
                findArray.push(config);
            }
        }

        this.log('debug', 'findWithPermissions', 'FINISHED');

        return findArray;
    }

    /**
     * create new Configuration
     *
     * @param {configuration} config new configuration
     * @param {object} options request options
     *
     * @return {configuration} created model
     */
    async createConfiguration(config, options) {
        this.log('debug', 'createConfiguration', 'STARTED');

        this.app.hookSingleton.executeHook('beforeCreate', 'Configuration', config);

        const userId = options.accessToken.userId;

        const baseConfiguration = this.app.models.baseConfiguration;
        const Configuration = this.app.models.configuration;
        const configModel = new ConfigurationModelClass(this.app);

        const allBases = await baseConfiguration.find({
            order: 'sequenceNumber ASC',
        });

        await this.createCrypt();

        const basesObj = {};
        const newObject = {};

        for (const base of allBases) {
            if (config[base.name] !== undefined) {
                basesObj[base.name] = config[base.name];
                const model = await configModel.findOneWithPermissions({
                    where: {
                        base: base.name,
                        name: config[base.name],
                    },
                }, options);

                if (model === null) {
                    this.log('debug', 'createConfiguration', 'FINISHED');
                    throw new HttpErrors.BadRequest(`Configuration model ${config[base.name]} does not exist`);
                }

                newObject[base.name] = config[base.name];
            }
        };

        for (let i = 1; i < allBases.length; i++) {
            const base = allBases[i];
            const parent = allBases[i - 1];
            const model = await configModel.findOneWithPermissions({
                where: {
                    base: parent.name,
                    name: config[parent.name],
                },
            }, options);

            if (model.options.hasRestrictions) {
                if (!model.restrictions.includes(config[base.name])) {
                    this.log('debug', 'createConfiguration', 'FINISHED');
                    throw new HttpErrors.BadRequest(`Model restrictions forbids this configuration`);
                }
            }
        }

        config.variables.map( (variable) => {
            if (variable.name === undefined || variable.name === null || variable.name === '') {
                this.log('debug', 'createConfiguration', 'FINISHED');
                throw new HttpErrors.BadRequest('Invalid variable: name not valid');
            }
            if (variable.type === undefined || variable.type === null || variable.type === '') {
                this.log('debug', 'createConfiguration', 'FINISHED');
                throw new HttpErrors.BadRequest('Invalid variable: type not valid');
            }

            if (variable.type === 'password' && variable.value !== '' &&
                variable.value !== null && variable.value !== undefined) {
                variable.value = this.encryptPassword(variable.value);
            }

            if (variable.type === 'number') {
                if (isNaN(variable.value)) {
                    this.log('debug', 'createConfiguration', 'FINISHED');
                    throw new HttpErrors.BadRequest('Invalid variable: value is not a number');
                }
            }

            const random = Math.random().toString(36).substr(2, 15);
            variable._id = random;
        });

        newObject.variables = config.variables;

        const configuration = this.app.models.configuration;
        let version = await configuration.count(basesObj);

        newObject.createdBy = userId;
        newObject.version = ++version;
        newObject.promoted = false;
        newObject.effectiveDate = undefined;
        newObject.deleted = false;


        const configObject = await Configuration.create(newObject);

        this.app.hookSingleton.executeHook('afterCreate', 'Configuration', configObject);

        this.log('debug', 'createConfiguration', 'FINISHED');

        return configObject;
    }

    /**
     * Promote configuration
     *
     * @param {string} id configuration id to promote
     * @param {object} options request options
     *
     */
    async promoteConfiguration(id, options) {
        this.log('debug', 'promoteConfiguration', 'STARTED');

        const toPromote = await this.findWithPermissions({
            where: {
                id: id,
            },
        }, options);

        if (toPromote.length === 0) {
            this.log('debug', 'promoteConfiguration', 'FINISHED');
            throw new HttpErrors.BadRequest('Invalid configuration id');
        }

        toPromote[0].promoted = true;
        await toPromote[0].save();

        this.log('debug', 'promoteConfiguration', 'FINISHED');

        return toPromote[0];
    }

    /**
     * Find all promotion candidates for given model
     *
     * @param {configuration} configuration configuration id
     * @param {object} options request options
     *
     */
    async findPromotionCandidates(configuration, options) {
        this.log('debug', 'findPromotionCandidates', 'STARTED');

        const promotion = this.app.models.promotion;
        const baseConfiguration = this.app.models.baseConfiguration;

        const bases = await baseConfiguration.find();

        const modelMap = new Map();
        bases.forEach((base) => {
            if (configuration[base.name] !== undefined && configuration[base.name] !== null) {
                modelMap.set(base.name, configuration[base.name]);
            }
        });

        if (modelMap.size === 0) {
            this.log('debug', 'findPromotionCandidates', 'FINISHED');
            throw new HttpErrors.BadRequest('Invalid configuration');
        }

        let whereFilter = {or: []};
        modelMap.forEach((value, key) => {
            whereFilter.or.push({
                base: key,
                toModels: value,
            });
        });

        const candidates = await promotion.find({
            where: whereFilter,
        });

        if (candidates.length === 0) {
            this.log('debug', 'findPromotionCandidates', 'FINISHED');
            return [];
        }

        whereFilter = {or: []};

        for (const cand of candidates) {
            const base = cand.base;
            const value = cand.fromModel;
            const filter = {};
            modelMap.forEach((value, key) => {
                if (key !== base) {
                    filter[key] = value;
                }
            });

            filter[base] = value;
            filter.promoted = true;

            whereFilter.or.push(filter);
        }

        const candConfig = await this.findWithPermissions({where: whereFilter, order: 'effectiveDate DESC'}, options);

        this.log('debug', 'findPromotionCandidates', 'FINISHED');

        return candConfig;
    }
};
