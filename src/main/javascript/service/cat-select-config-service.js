'use strict';

angular.module('cat.service.selectConfig').provider('catSelectConfigService', CatSelectConfigServiceProvider);


/**
 * @ngdoc service
 * @name cat.service.selectConfig:catSelectConfigService
 * @constructor
 */
function CatSelectConfigServiceProvider() {
    var configs = {};

    this.config = function (name, config) {
        if (!_.isUndefined(config)) {
            configs[name] = config;
        }

        return configs[name];
    };

    this.$get = function () {
        return new CatSelectConfigService(configs);
    };
}

function assignDeep(target, source) {
    return _.assign(target, source, function (targetProperty, sourceProperty) {
        if (_.isObject(targetProperty) && _.isObject(sourceProperty)) {
            return assignDeep(targetProperty, sourceProperty);
        }

        return sourceProperty;
    });
}

function CatSelectConfigService(configs) {
    var _configs = configs;

    this.getConfig = function (name, options) {
        var config = configs[name];

        if (_.isUndefined(config) && _.isUndefined(options)) {
            return undefined;
        }

        return assignDeep(_.clone(config) || {}, options);
    };
}