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

        const model = context.modelName;
        let access = context.accessType;

        if (access === 'READ') {
            access = 'view';
        } else {
            access = 'modify';
        }

        let hasPermissions = false;
        const roleToCheck = `${model}.${access}`;

        roles.forEach((role) => {
            if (role === roleToCheck) {
                hasPermissions = true;
            }
        });

        if (!hasPermissions) {
            if (model === 'configurationModel' && access === 'view') {
                if (roles.includes('configuration.modify') && roles.includes('configuration.view')) {
                    hasPermissions = true;
                }
            }
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
