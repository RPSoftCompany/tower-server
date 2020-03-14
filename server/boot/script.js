// const cryptoRandomString = require('crypto-random-string');

// /**
//  * makeRandom - Returns random string
//  *
//  * @param {string} nChar string length
//  * @return {string} random string
//  */
// function makeRandom(nChar) {
//     return cryptoRandomString({
//         length: nChar,
//     });
// }

module.exports = async (app) => {
    const Member = app.models.Member;
    const Role = app.models.Role;
    const RoleMapping = app.models.RoleMapping;
    const v1 = app.models.v1;
    const connection = app.models.connection;

    let admin = await Member.findOne({
        where: {
            username: 'admin',
        },
    });

    if (admin === null || admin === undefined) {
        admin = await Member.create({
            username: 'admin',
            email: 'admin@admin.com',
            password: 'admin',
            groups: [],
            newUser: true,
        }, );
    }

    const rolesList = [{
        name: 'admin',
    },
    {
        name: 'configuration.view',
    },
    {
        name: 'configuration.modify',
    },
    ];

    for (role of rolesList) {
        const newRole = await Role.upsertWithWhere({
            name: role.name,
        }, role);

        if (newRole.name === 'admin') {
            const mapped = await RoleMapping.findOne({
                where: {
                    principalType: RoleMapping.USER,
                    principalId: admin.id,
                },
            });

            if (mapped === null || mapped == undefined) {
                await newRole.principals.create({
                    principalType: RoleMapping.USER,
                    principalId: admin.id,
                });
            }
        }
    }

    await connection.findOrCreate({
        system: 'LDAP',
    });

    await connection.findOrCreate({
        system: 'Vault',
    });

    const wasBooted = await v1.findOne({
        where: {
            booted: true,
        },
    });

    if (wasBooted === null) {
        v1.create([{
            booted: true,
        }]);
    }
};
