girder.views.jobs_JobListWidget = girder.View.extend({
    events: {
        'click .g-job-checkbox-menu input': function (e) {
            var cid = $(e.target).attr('cid');
            this.trigger('g:jobClicked', this.collection.get(cid));
        }
    },

    initialize: function (settings) {
        this.columns = settings.columns || this.columnEnum.COLUMN_ALL;
        this.filter = settings.filter || {
            userId: girder.currentUser.id
        };
        this.typeFilter = {};
        this.statusFilter = {};

        this.collection = new girder.collections.JobCollection();
        this.collection.sortField = settings.sortField || 'created';
        this.collection.sortDir = settings.sortDir || girder.SORT_DESC;
        this.collection.pageLimit = settings.pageLimit || this.collection.pageLimit;

        this.collection.on('g:changed', function () {
            this.render();
        }, this).fetch(this.filter);

        this.showHeader = _.has(settings, 'showHeader') ? settings.showHeader : true;
        this.showPaging = _.has(settings, 'showPaging') ? settings.showPaging : true;
        this.linkToJob = _.has(settings, 'linkToJob') ? settings.linkToJob : true;
        this.triggerJobClick = _.has(settings, 'triggerJobClick') ? settings.triggerJobClick : false;

        this.paginateWidget = new girder.views.PaginateWidget({
            collection: this.collection,
            parentView: this
        });

        this.filterTypeMenuWidget = new girder.views.jobs.CheckBoxMenuWidget({
            title: 'Type',
            values: [],
            parentView: this
        });

        this.filterTypeMenuWidget.on('g:triggerCheckBoxMenuChanged', function (e) {
            this.typeFilter = e;
            this.render();
        }, this);

        this.filterStatusMenuWidget = new girder.views.jobs.CheckBoxMenuWidget({
            title: 'Status',
            values: [],
            parentView: this
        });

        this.filterStatusMenuWidget.on('g:triggerCheckBoxMenuChanged', function (e) {
            this.statusFilter = e;
            this.render();
        }, this);

        girder.eventStream.on('g:event.job_status', this._statusChange, this);
    },

    columnEnum: girder.defineFlags([
        'COLUMN_STATUS_ICON',
        'COLUMN_TITLE',
        'COLUMN_UPDATED',
        'COLUMN_OWNER',
        'COLUMN_TYPE',
        'COLUMN_STATUS'
    ], 'COLUMN_ALL'),

    render: function () {
        var jobs = this._filterJobs(this.collection.toArray()), types, states;

        this.$el.html(girder.templates.jobs_jobList({
            jobs: jobs,
            showHeader: this.showHeader,
            columns: this.columns,
            columnEnum: this.columnEnum,
            linkToJob: this.linkToJob,
            triggerJobClick: this.triggerJobClick,
            girder: girder
        }));

        types = _.uniq(this.collection.toArray().map(function (job) {
            return job.attributes.type;
        }));

        this._updateFilter(this.typeFilter, types);
        this.filterTypeMenuWidget.setValues(this.typeFilter);

        states = _.uniq(this.collection.toArray().map(function (job) {
            return girder.jobs_JobStatus.text(job.attributes.status);
        }));
        this._updateFilter(this.statusFilter, states);
        this.filterStatusMenuWidget.setValues(this.statusFilter);

        this.filterTypeMenuWidget.setElement(this.$('.g-job-type-header')).render();
        this.filterStatusMenuWidget.setElement(this.$('.g-job-status-header')).render();

        if (this.showPaging) {
            this.paginateWidget.setElement(this.$('.g-job-pagination')).render();
        }

        return this;
    },

    _statusChange: function (event) {
        var job = event.data,
            tr = this.$('tr[jobId=' + job._id + ']');

        if (!tr.length) {
            return;
        }

        if (this.columns & this.columnEnum.COLUMN_STATUS_ICON) {
            tr.find('td.g-status-icon-container').attr('status', job.status)
              .find('i').removeClass().addClass(girder.jobs_JobStatus.icon(job.status));
        }
        if (this.columns & this.columnEnum.COLUMN_STATUS) {
            tr.find('td.g-job-status-cell').text(girder.jobs_JobStatus.text(job.status));
        }
        if (this.columns & this.columnEnum.COLUMN_UPDATED) {
            tr.find('td.g-job-updated-cell').text(
                girder.formatDate(job.updated, girder.DATE_SECOND));
        }

        tr.addClass('g-highlight');

        window.setTimeout(function () {
            tr.removeClass('g-highlight');
        }, 1000);
    },
    _filterJobs: function (jobs) {
        var filterJobs = [];

        // Include all jobs that have matching state or type field.
        filterJobs = this.collection.filter(_.bind(function (job) {
            return ((_.isEmpty(this.typeFilter) || _.isUndefined(job.attributes.type) ||
                        this.typeFilter[job.attributes.type]) &&
                    (_.isEmpty(this.statusFilter) || _.isUndefined(job.attributes.status) ||
                        this.statusFilter[girder.jobs_JobStatus.text(job.attributes.status)]));
        }, this));

        return filterJobs;
    },
    _updateFilter: function (filter, newValues) {
        // We need to work out what keys have been removed or added
        // so we can update the filter. We do this rather than created
        // a new filter inorder to preserve the existing user selections.
        var currentValues = _.keys(filter), added, removed;
        added = _.difference(newValues, currentValues);
        removed = _.difference(currentValues, newValues);

        _.each(added, function (value) {
            filter[value] = true;
        });
        _.each(removed, function (value) {
            delete filter[value];
        });
    }
});

girder.router.route('jobs/user/:id', 'jobList', function (id) {
    girder.events.trigger('g:navigateTo', girder.views.jobs_JobListWidget, {
        filter: {userId: id}
    });
});
