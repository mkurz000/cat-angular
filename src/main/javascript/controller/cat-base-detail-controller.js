'use strict';

/**
 * @ngdoc function
 *
 * @description
 * The CatBaseDetailController takes care of providing several common properties and functions to the scope
 * of every detail page. It also instantiates the controller given via the config.controller parameter and shares
 * the same scope with it.
 *
 * Common properties include:
 * * detail - the actual object to view
 * * editDetail - a copy of the detail object used for editing
 * * breadcrumbs - the breadcrumbs array
 * * uiStack - the ui stack array if parents exist
 * * editTemplate - the url of the edit template
 * * mainViewTemplate - the url of the main view template
 * * additionalViewTemplate - the url of the additional view template if it exists
 * * $fieldErrors - a map of validation errors returned by the server
 *
 * Common functions include:
 * * save - the save function to update / create an object
 * * edit - a function to switch from view to edit mode
 * * cancelEdit - a function to switch from edit to view mode (discarding all changes)
 * * add - a function to switch into edit mode of a new object
 * * remove - a function to delete the current object
 * * title - a function to resolve a 'title' of the current object
 *
 * @param $scope
 * @param $routeParams
 * @param $breadcrumbs
 * @param $location
 * @param $window
 * @param $globalMessages
 * @param $controller
 * @param {Object} config holds data like the current api endpoint, template urls, base url, the model constructor, etc.
 * @param {Object} detail the actual object which is shown / edited
 * @param {Array} parents the list of 'parent' objects used for breadcrumb / ui stack generation
 * @constructor
 */
function CatBaseDetailController($scope, $routeParams, $breadcrumbs, $location, $window, $globalMessages, $controller, config, detail, parents) {
    $scope.detail = detail;
    $scope.editDetail = undefined;
    $scope.$fieldErrors = {};

    var endpoint = config.endpoint;
    var baseUrl = config.baseUrl;
    var templateUrls = config.templateUrls;
    var Model = config.Model;

    var breadcrumbs = [];

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.substring(1);
    }

    $scope.uiStack = [];

    function splitShiftAndJoin(path, amount) {
        return _.initial(path.split('/'), amount).join('/');
    }

    if (!_.isUndefined(config.endpoint.parentEndpoint)) {
        var currentEndpoint = config.endpoint;
        var parentEndpoint = currentEndpoint.parentEndpoint;
        var parentUrl = baseUrl;
        var count = 0;

        while (!_.isUndefined(parentEndpoint)) {
            var parent = parents[count++];
            parentUrl = splitShiftAndJoin(parentUrl, 1);

            var detailBreadcrumb = {
                url: '#' + parentUrl + '?tab=' + currentEndpoint.getEndpointName() + 's',
                title: parent.name
            };
            $scope.uiStack.unshift(detailBreadcrumb);
            breadcrumbs.unshift(detailBreadcrumb);

            parentUrl = splitShiftAndJoin(parentUrl, 1);
            var breadcrumb = {
                title: capitalize(parentEndpoint.getEndpointName()) + 's',
                url: '#' + parentUrl
            };
            breadcrumbs.unshift(breadcrumb);

            currentEndpoint = parentEndpoint;
            parentEndpoint = currentEndpoint.parentEndpoint;
        }
    } else {
        breadcrumbs.push({
            title: capitalize(config.endpoint.getEndpointName()) + 's',
            url: '#' + baseUrl
        });
    }

    breadcrumbs.push(
        {
            title: $routeParams.id === 'new' ? 'New' : ''
        }
    );

    $breadcrumbs.set(breadcrumbs);

    $scope.editTemplate = templateUrls.edit;

    if (_.isObject(templateUrls.view)) {
        $scope.mainViewTemplate = templateUrls.view.main;
        $scope.additionalViewTemplate = templateUrls.view.additional;
    } else {
        $scope.mainViewTemplate = templateUrls.view;
    }

    $scope.baseUrl = baseUrl;

    /**
     * @returns {String|Number} A title of the current object or the 'id' as fallback
     */
    $scope.title = function () {
        var data = $scope.detail;
        if (_.isUndefined(data)) {
            return '';
        }
        return !!data.breadcrumbTitle ? data.breadcrumbTitle() : (!!data.name ? data.name : data.id);
    };

    var update = function () {
        $breadcrumbs.replaceLast({
            title: $scope.title()
        });
    };

    /**
     * reloads the current object from the server
     */
    var reload = function () {
        endpoint.get($routeParams.id).then(function (data) {
            $scope.detail = data;
            update();
        });
    };

    $scope.reloadDetails = reload;

    $scope.exists = !!$routeParams.id && $routeParams.id !== 'new';

    /**
     * Creates a new copy of the given model and sets its parent if applicable.
     * Triggers a switch into the edit mode
     */
    $scope.add = function () {
        $scope.editDetail = new Model();
        if (_.isFunction($scope.editDetail.setParent)) {
            $scope.editDetail.setParent(parents[0]);
        }
    };

    /**
     * Creates a copy of the current object and triggers a switch into edit mode
     */
    $scope.edit = function () {
        $scope.editDetail = angular.copy($scope.detail);
        if (_.isFunction($scope.editDetail.setParent)) {
            $scope.editDetail.setParent(parents[0]);
        }
    };

    /**
     * Either cancels the current edit of an object by resetting it or triggers a history back event if the 'new' mode
     * is active
     */
    $scope.cancelEdit = function () {
        $scope.$broadcast('formReset');
        if ($scope.exists) {
            $scope.editDetail = undefined;
            $globalMessages.clearMessages();
            $scope.$fieldErrors = undefined;
        } else {
            $window.history.back();
        }
    };

    /**
     * Calls the remove function of the current endpoint and redirects to the given baseUrl upon success
     */
    $scope.remove = function () {
        endpoint.remove($scope.detail.id).then(function () {
            $location.path(baseUrl);
        });
    };

    /**
     * Calls the save function of the current endpoint.
     * Upon success the view mode of the details of the currently created / updated object will be shown.
     * Upon an error the reported errors (global & field errors) will be shown to the user and the edit mode
     * will remain active.
     */
    $scope.save = function () {
        endpoint.save($scope.editDetail).then(function (data) {
            $globalMessages.clearMessages();
            $scope.$fieldErrors = undefined;
            if (!$scope.exists) {
                $scope.$broadcast('formReset');
                $location.path(baseUrl + '/' + data.id);
            } else {
                $scope.editDetail = undefined;
                $scope.detail = data;
                update();
            }
        }, function (response) {
            if (!response.data.fieldErrors) {
                $scope.$fieldErrors = undefined;
                return;
            }
            // group by field
            var fieldErrors = {};
            _.forEach(response.data.fieldErrors, function (fieldError) {
                fieldErrors[fieldError.field] = fieldErrors[fieldError.field] || [];
                fieldErrors[fieldError.field].push(fieldError.message);
            });

            $scope.$fieldErrors = fieldErrors;
            $scope.$broadcast('fieldErrors', fieldErrors);
        });
    };

    if ($scope.exists) {
        if (_.isUndefined($scope.detail)) {
            reload();
        } else {
            update();
        }
    } else {
        if (_.isUndefined($scope.detail)) {
            $scope.add();
        } else {
            $scope.edit();
        }
    }

    // extend with custom controller
    $controller(config.controller, {$scope: $scope, detail: detail, parents: parents, config: config});
}

angular.module('cat').controller('CatBaseDetailController', CatBaseDetailController);