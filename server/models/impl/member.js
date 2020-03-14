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
const LdapAuth = require('ldapauth-fork');

module.exports = class Member {
    /**
     * Constructor
     *
     * @param {object} app APP
     */
    constructor(app) {
        this.configurationName = 'member';
        this.logger = null;

        this.app = app;

        this.ldapClient = null;
    }

    /**
     * logger
     *
     * @param {string} severity Severity
     * @param {string} method current method
     * @param {string} message Message to log
     * @param {string} obj object to log
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
     * initializeLDAP
     *
     * @return {LdapClient} ldapClient object
     */
    async initializeLDAP() {
        this.log('debug', 'initializeLDAP', 'STARTED');

        const Connection = this.app.models.connection;
        const server = await Connection.findOne({
            where: {
                system: 'LDAP',
                enabled: true,
            },
        });

        if (server !== null) {
            this.log('debug', 'initializeLDAP', 'FINISHED');
            return new LdapAuth(server);
        } else {
            this.log('debug', 'initializeLDAP', 'FINISHED');
            return null;
        }
    }

    /**
     * login
     *
     * @param {object} credentials Object with username and password
     * @param {string} include Optionally set it to "user" to include the user info
     * @param {string} ttl Optional token ttl
     *
     * @return {object} access token details (Optionally user data)
     */
    async login(credentials, include, ttl) {
        this.log('debug', 'login', 'STARTED');

        if (ttl === undefined) {
            ttl = 86400;
        }

        const User = this.app.models.member;

        let ldap = null;
        if (credentials.username !== 'admin') {
            ldap = await this.initializeLDAP();
        }

        if (ldap !== null && credentials.username !== 'admin') {
            ldap.on('error', (err) => {
                this.log('error', 'login', `Error connecting to LDAP: ${err}`);
            });

            const auth = (username, password) => {
                return new Promise((resolve) => ldap.authenticate(username, password, (err, user) => {
                    resolve({
                        user,
                        err,
                    });
                }));
            };

            const out = await auth(credentials.username, credentials.password);

            if (out.err !== null) {
                this.log('error', 'login', out.err);
                this.log('debug', 'login', 'FINISHED');
                throw new HttpErrors.Unauthorized('Invalid username or password');
            }

            let user = await User.findOne({
                where: {
                    username: credentials.username,
                },
            });

            if (user === null) {
                user = await User.create({
                    username: credentials.username,
                    type: 'ldap',
                    newUser: false,
                    groups: [],
                    technicalUser: false,
                });
            };

            const ldapUser = await user.createAccessToken(ttl);

            const output = {
                ttl: ldapUser.ttl,
                userId: ldapUser.userId,
                created: ldapUser.created,
                id: ldapUser.id,
            };

            if (include === 'user') {
                output.user = {
                    groups: user.groups,
                    newUser: false,
                    type: user.type,
                };
            }

            const AccessToken = this.app.models.AccessToken;
            const tokens = await AccessToken.find({
                where: {
                    userId: ldapUser.userId,
                },
            });

            tokens.forEach((el) => {
                el.validate((err, isValid) => {
                    if (!isValid) {
                        el.destroy();
                    }
                });
            });

            this.log('info', 'login', `User '${credentials.username}' logged in`);
            this.log('debug', 'login', 'FINISHED');

            return output;
        } else {
            const member = await User.findOne({
                where: {
                    username: credentials.username,
                },
            });

            if (member !== null && member !== undefined) {
                if (member.technicalUser) {
                    this.log('debug', 'login', 'FINISHED');
                    throw new HttpErrors.Unauthorized('User is technical only');
                }

                if (member.type === 'ldap') {
                    this.log('debug', 'login', 'FINISHED');
                    throw new HttpErrors.ServiceUnavailable('No LDAP connection');
                }
            }

            credentials.ttl = ttl;

            const user = await User.login(credentials, include);

            const output = {
                ttl: user.ttl,
                userId: user.userId,
                created: user.created,
                id: user.id,
            };

            if (include === 'user') {
                output.user = {
                    groups: member.groups,
                    newUser: member.newUser,
                    type: member.type,
                    technicalUser: member.technicalUser,
                };
            }

            const AccessToken = this.app.models.AccessToken;
            const tokens = await AccessToken.find({
                where: {
                    userId: user.userId,
                },
            });

            tokens.forEach((el) => {
                el.validate((err, isValid) => {
                    if (!isValid) {
                        el.destroy();
                    }
                });
            });

            this.log('info', 'login', `User ${credentials.username} logged in`);
            this.log('debug', 'login', 'FINISHED');

            return output;
        }
    }

    /**
     * Login using basic auth
     *
     * @param {object} context request context
     *
     * @return {object} access token details (Optionally user data)
     */
    async basicAuthLogin(context) {
        this.log('debug', 'basicAuthLogin', 'STARTED');

        const headers = context.req.headers;
        if (headers.authorization !== undefined) {
            if (headers.authorization.startsWith('Basic ')) {
                const base = headers.authorization.replace('Basic ', '');
                const buff = Buffer.from(base, 'base64');
                const text = buff.toString('utf-8');

                const split = text.split(':');

                if (split.length != 2) {
                    return false;
                } else {
                    const username = split[0];
                    const pass = split[1];

                    try {
                        const token = await this.login({
                            username: username,
                            password: pass,
                        }, undefined, 5);

                        if (token !== undefined && token !== null) {
                            if (token.id !== undefined && token.id !== null) {
                                return token;
                            }
                        }
                    } catch (e) {
                        return null;
                    }
                }
            }
        }

        this.log('debug', 'basicAuthLogin', 'FINISHED');

        return null;
    }

    /**
     * changeUserPassword
     *
     * @param {object} password New password
     * @param {string} userId User Id
     */
    async changeUserPassword(password, userId) {
        this.log('debug', 'changeUserPassword', 'STARTED');

        const Member = this.app.models.member;

        await Member.setPassword(userId, password);
        Member.updateAll({
            id: userId,
        }, {
            newUser: false,
        });

        this.log('debug', 'changeUserPassword', 'FINISHED');
    }

    /**
     * getUserDetails
     *
     * @param {string} userId User Id
     *
     * @return { object } returns user data
     */
    async getUserDetails(userId) {
        this.log('debug', 'getUserDetails', 'STARTED');

        const Member = this.app.models.member;

        const user = await Member.findOne({
            where: {
                id: userId,
            },
        });

        let data = null;

        if (user !== null) {
            data = {
                username: user.username,
                technicalUser: user.technicalUser,
                type: user.type,
            };
        }

        this.log('debug', 'getUserDetails', 'FINISHED');

        return data;
    }


    /**
     * getUserRoles
     *
     * @param {string} userId User Id
     *
     * @return { [Role] } returns all user roles
     */
    async getUserRoles(userId) {
        this.log('debug', 'getUserRoles', 'STARTED');

        const Member = this.app.models.member;
        const Group = this.app.models.group;

        const user = await Member.findOne({
            where: {
                id: userId,
            },
        });

        const groups = await Group.find({
            where: {
                name: {
                    inq: user.groups,
                },
            },
        });

        const roles = new Set();
        groups.forEach((group) => {
            if (group.roles !== undefined) {
                group.roles.forEach((role) => {
                    roles.add(role);
                });
            }
        });

        this.log('debug', 'getUserRoles', 'FINISHED');

        return Array.from(roles);
    }

    /**
     * getUserGroups
     *
     * @param {string} userId User Id
     *
     * @return { [string] } returns all user roles
     */
    async getUserGroups(userId) {
        this.log('debug', 'getUserGroups', 'STARTED');

        const Member = this.app.models.member;

        const user = await Member.findOne({
            where: {
                id: userId,
            },
        });

        this.log('debug', 'getUserGroups', 'FINISHED');

        return user.groups;
    }

    /**
     * addUserGroup
     *
     * @param {string} userId User Id
     * @param {string} groupName Group name
     *
     * @return { [string] } returns all user grups
     */
    async addUserGroup(userId, groupName) {
        this.log('debug', 'addUserGroup', 'STARTED');

        const Member = this.app.models.member;
        const Group = this.app.models.group;

        const user = await Member.findOne({
            where: {
                id: userId,
            },
        });

        if (user.groups.includes(groupName)) {
            return user.groups;
        }

        const group = Group.findOne({
            where: {
                name: groupName,
            },
        });

        if (group === undefined || group === null) {
            throw new HttpErrors.BadRequest('Invalid group');
        }

        user.groups.push(groupName);

        await user.save();

        this.log('debug', 'addUserGroup', 'FINISHED');

        return user.groups;
    }

    /**
     * removeUserGroup
     *
     * @param {string} userId User Id
     * @param {string} groupName Group name
     *
     * @return { [string] } returns all user grups
     */
    async removeUserGroup(userId, groupName) {
        this.log('debug', 'removeUserGroup', 'STARTED');

        const Member = this.app.models.member;

        const user = await Member.findOne({
            where: {
                id: userId,
            },
        });

        if (!user.groups.includes(groupName)) {
            return user.groups;
        }

        user.groups = user.groups.filter((group) => {
            return group !== groupName;
        });

        await user.save();

        this.log('debug', 'removeUserGroup', 'FINISHED');

        return user.groups;
    }

    /**
     * setAsTechnicalUser
     *
     * Sets user as a technical user, which means, that it has non time limited token
     *
     * @param {string} userId User Id
     * @param {boolean} isTechUser if user is tech or not
     *
     * @return {Member} returns user
     */
    async setAsTechnicalUser(userId, isTechUser) {
        this.log('debug', 'setAsTechnicalUser', 'STARTED');

        const Member = this.app.models.member;
        const AccessToken = this.app.models.AccessToken;

        const user = await Member.findOne({
            where: {
                id: userId,
            },
        });

        if (user === undefined || user === null) {
            throw new HttpErrors.BadRequest('Invalid user');
        }

        user.technicalUser = isTechUser;

        await user.save();

        await AccessToken.destroyAll({
            userId: userId,
        });

        if (isTechUser) {
            await user.createAccessToken(-1);
        }

        this.log('debug', 'setAsTechnicalUser', 'FINISHED');

        return user;
    }

    /**
     * getTechnicalUserToken
     *
     * @param {string} userId User Id
     *
     * @return {string} returns tokenId
     */
    async getTechnicalUserToken(userId) {
        this.log('debug', 'getTechnicalUserToken', 'STARTED');

        const Member = this.app.models.member;
        const AccessToken = this.app.models.AccessToken;

        const user = await Member.findOne({
            where: {
                id: userId,
                technicalUser: true,
            },
        });

        if (user === undefined || user === null) {
            throw new HttpErrors.BadRequest('Invalid user');
        }

        const token = await AccessToken.findOne({
            where: {
                userId: userId,
            },
        });

        if (token === undefined || token === null) {
            throw new HttpErrors.NotFound('Token not found');
        }

        this.log('debug', 'getTechnicalUserToken', 'FINISHED');

        return token.id;
    }
};
