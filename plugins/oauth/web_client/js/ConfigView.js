/**
 * Administrative configuration view. Shows the global-level settings for this
 * plugin for all of the supported oauth providers.
 */
girder.views.oauth_ConfigView = girder.View.extend({
    events: {
        'submit .g-oauth-provider-form': function (event) {
            event.preventDefault();
            var providerId = $(event.target).attr('provider-id');
            this.$('#g-oauth-provider-' + providerId  + '-error-message').empty();

            this._saveSettings(providerId, [{
                key: 'oauth.' + providerId + '_client_id',
                value: this.$('#g-oauth-provider-' + providerId + '-client-id').val().trim()
            }, {
                key: 'oauth.' + providerId + '_client_secret',
                value: this.$('#g-oauth-provider-' + providerId + '-client-secret').val().trim()
            }]);
        }
    },

    initialize: function () {
        this.providers = [{
            id: 'google',
            name: 'Google',
            icon: 'gplus',
            hasAuthorizedOrigins: true,
            instructions: 'Client IDs and secret keys are managed in the Google ' +
                          'Developer Console. When creating your client ID there, ' +
                          'use the following values:'
        }, {
            id: 'globus',
            name: 'Globus',
            icon: 'globe',
            hasAuthorizedOrigins: false,
            instructions: 'Client IDs and secret keys are managed in the Google ' +
                          'Developer Console. When creating your client ID there, ' +
                          'use the following values:'
        }, {
            id: 'github',
            name: 'GitHub',
            icon: 'github-circled',
            hasAuthorizedOrigins: false,
            instructions: 'Client IDs and secret keys are managed in the ' +
                          'Applications page of your GitHub account settings. ' +
                          'Use the following as the authorization callback URL:'
        }, {
            id: 'bitbucket',
            name: 'Bitbucket',
            icon: 'bitbucket',
            hasAuthorizedOrigins: false,
            instructions: 'Client IDs and secret keys are managed in the ' +
                          'Applications page of your Bitbucket account settings. ' +
                          'Use the following as the authorization callback URL:'
        }, {
            id: 'linkedin',
            name: 'LinkedIn',
            icon: 'linkedin',
            hasAuthorizedOrigins: false,
            instructions: 'Client IDs and secret keys are managed at the ' +
                          'Applications page of the LinkedIn Developers site. ' +
                          'Select the "r_basicprofile" and "r_emailaddress" ' +
                          'Default Application Permissions, and use the ' +
                          'following as an OAuth 2.0 Authorized Redirect URL:'
        }];
        this.providerIds = _.map(this.providers, function (provider) {
            return provider.id;
        });

        var settingKeys = [];
        _.each(this.providerIds, function (id) {
            settingKeys.push('oauth.' + id + '_client_id');
            settingKeys.push('oauth.' + id + '_client_secret');
        }, this);

        girder.restRequest({
            type: 'GET',
            path: 'system/setting',
            data: {
              list: JSON.stringify(settingKeys)
            }
        }).done(_.bind(function (resp) {
            this.settingVals = resp;
            this.render();
        }, this));
    },

    render: function () {
        var origin = window.location.protocol + '//' + window.location.host,
            apiRoot = girder.apiRoot;

        if (apiRoot.substring(0, 1) !== '/') {
            apiRoot = '/' + apiRoot;
        }

        this.$el.html(girder.templates.oauth_config({
            origin: origin,
            apiRoot: apiRoot,
            providers: this.providers
        }));

        if (!this.breadcrumb) {
            this.breadcrumb = new girder.views.PluginConfigBreadcrumbWidget({
                pluginName: 'OAuth login',
                el: this.$('.g-config-breadcrumb-container'),
                parentView: this
            }).render();
        }

        if (this.settingVals) {
            _.each(this.providerIds, function (id) {
                this.$('#g-oauth-provider-' + id + '-client-id').val(
                    this.settingVals['oauth.' + id + '_client_id']);
                this.$('#g-oauth-provider-' + id + '-client-secret').val(
                    this.settingVals['oauth.' + id + '_client_secret']);
            }, this);
        }

        return this;
    },

    _saveSettings: function (providerId, settings) {
        settings.push({
            key: 'oauth.providers_enabled',
            value: _.filter(this.providerIds, function (id) {
                return !!this.$('#g-oauth-provider-' + id + '-client-id').val();
            }, this)
        });

        girder.restRequest({
            type: 'PUT',
            path: 'system/setting',
            data: {
                list: JSON.stringify(settings)
            },
            error: null
        }).done(_.bind(function (resp) {
            girder.events.trigger('g:alert', {
                icon: 'ok',
                text: 'Settings saved.',
                type: 'success',
                timeout: 3000
            });
        }, this)).error(_.bind(function (resp) {
            this.$('#g-oauth-provider-' + providerId + '-error-message').text(
                resp.responseJSON.message);
        }, this));
    }
});

girder.router.route('plugins/oauth/config', 'oauthConfig', function () {
    girder.events.trigger('g:navigateTo', girder.views.oauth_ConfigView);
});
