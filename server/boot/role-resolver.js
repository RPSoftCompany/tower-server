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

const MemberClass = require('../models/impl/member.js');

module.exports = function(app) {
    const Role = app.models.Role;

    const remotes = app.remotes();
    const baseAuth = remotes.authorization;
    remotes.authorization = async (context, next) => {
        const member = new MemberClass(app);
        const token = await member.basicAuthLogin(context);

        if (token === null) {
            baseAuth(context, next);
        } else {
            if (context.args.options === undefined) {
                context.args.options = {};
            }
            context.args.options.accessToken = token;
            next();
        }
    };

    Role.registerResolver('groupSolver', async (_role, context) => {
        const logger = app.get('winston');

        logger.log('debug', `groupSolver => STARTED`);

        logger.log('debug', `groupSolver => MODEL: ${context.modelName}`);
        logger.log('debug', `groupSolver => PROPERTY: ${context.accessType}`);

        const member = new MemberClass(app);

        const roles = await member.getUserRoles(context.accessToken.userId);

        if (roles.includes('admin')) {
            return true;
        }

        let model = context.modelName;
        let access = context.accessType;

        if (access === 'READ') {
            access = 'view';
        } else {
            access = 'modify';
        }

        if (model === 'v1') {
            model = 'configuration';
            access = 'view';
        }

        let hasPermissions = false;
        let roleToCheck = `${model}.${access}`;

        roles.forEach((role) => {
            if (role === roleToCheck) {
                hasPermissions = true;
            }
        });

        if (model === 'configurationModel' && access === 'modify' && hasPermissions) {
            let modelId = context.modelId;

            if (modelId === undefined) {
                const req = context.remotingContext.req;
                if (req.method === 'PUT' || req.method === 'PATCH') {
                    if (hasPermissions) {
                        if (req.body.id !== undefined) {
                            modelId = req.body.id;
                        }
                    }
                }
            }

            hasPermissions = false;

            if (modelId !== null) {
                const ConfModel = app.models.configurationModel;
                const conf = await ConfModel.findOne({
                    where: {
                        id: modelId,
                    },
                });

                hasBasePermissions = false;

                roleToCheck = `baseConfigurations.${conf.base}.${access}`;
                roles.forEach((role) => {
                    if (role === roleToCheck) {
                        hasBasePermissions = true;
                    }
                });

                if (hasBasePermissions) {
                    const Role = app.models.Role;
                    const specificRole = await Role.findOne({
                        where: {
                            name: `${model}.${conf.base}.${conf.name}.${access}`,
                        },
                    });

                    if (specificRole === null) {
                        hasPermissions = true;
                    } else {
                        roleToCheck = `${model}.${conf.base}.${conf.name}.${access}`;
                        roles.forEach((role) => {
                            if (role === roleToCheck) {
                                hasPermissions = true;
                            }
                        });
                    }
                }
            } else {
                const base = context.remotingContext.req.body.base;
                if (base !== undefined) {
                    const Role = app.models.Role;
                    const specificRole = await Role.findOne({
                        where: {
                            name: `${model}.${base}.${conf.name}.${access}`,
                        },
                    });

                    if (specificRole === null) {
                        hasPermissions = true;
                    } else {
                        roleToCheck = `${model}.${conf.base}.${conf.name}.${access}`;
                        roles.forEach((role) => {
                            if (role === roleToCheck) {
                                hasPermissions = true;
                            }
                        });
                    }
                }
            }
        }

        if (!hasPermissions) {
            // if (model === 'configurationModel' && access === 'view') {
            //     if (roles.includes('configuration.modify') && roles.includes('configuration.view')) {
            //         hasPermissions = true;
            //     }
            // }
            if (model === 'v1') {
                if (roles.includes('configuration.view')) {
                    hasPermissions = true;
                }
            }
        }

        logger.log('debug', `groupSolver => FINISHED`);

        return hasPermissions;
    });
};
