module.exports = function(server) {
    const Member = server.models.member;
    const Role = server.models.Role;
    const RoleMapping = server.models.RoleMapping;

    RoleMapping.belongsTo(Member);
    Member.hasMany(RoleMapping, {foreignKey: 'principalId'});
    Role.hasMany(Member, {through: RoleMapping, foreignKey: 'roleId'});

    RoleMapping.defineProperty('principalId', {
        type: function(id) {
            return require('mongodb').ObjectId('' + id);
        },
    });
};
