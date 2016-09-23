$(function () {
    /* Include the built version of the our templates.  This means that grunt
    * must be run to generate these before the test. */
    girderTest.addCoveredScripts([
        '/static/built/plugins/jobs/templates.js',
        '/plugins/jobs/web_client/js/misc.js',
        '/plugins/jobs/web_client/js/views/CheckBoxMenu.js',
        '/plugins/jobs/web_client/js/views/JobDetailsWidget.js',
        '/plugins/jobs/web_client/js/views/JobListWidget.js'
    ]);
    girderTest.importStylesheet(
        '/static/built/plugins/jobs/plugin.min.css'
    );

    girder.events.trigger('g:appload.before');
    var app = new girder.App({
        el: 'body',
        parentView: null
    });
    girder.events.trigger('g:appload.after');

    describe('Unit test the job detail widget.', function () {
        it('Show a job detail widget.', function () {
            waitsFor('app to render', function () {
                return $('#g-app-body-container').length > 0;
            });

            runs(function () {
                var job = new girder.models.JobModel({
                    _id: 'foo',
                    title: 'My batch job',
                    status: girder.jobs_JobStatus.INACTIVE,
                    log: ['Hello world\n', 'goodbye world'],
                    updated: '2015-01-12T12:00:12Z',
                    created: '2015-01-12T12:00:00Z',
                    when: '2015-01-12T12:00:00Z',
                    timestamps: [{
                        status: girder.jobs_JobStatus.QUEUED,
                        time: '2015-01-12T12:00:02Z'
                    }, {
                        status: girder.jobs_JobStatus.RUNNING,
                        time: '2015-01-12T12:00:03Z'
                    }, {
                        status: girder.jobs_JobStatus.SUCCESS,
                        time: '2015-01-12T12:00:12Z'
                    }]
                });

                var widget = new girder.views.jobs_JobDetailsWidget({
                    el: $('#g-app-body-container'),
                    job: job,
                    parentView: app
                }).render();

                expect($('.g-monospace-viewer[property="kwargs"]').length).toBe(0);
                expect($('.g-monospace-viewer[property="log"]').text()).toBe(job.get('log').join(''));
                expect($('.g-job-info-value[property="_id"]').text()).toBe(job.get('_id'));
                expect($('.g-job-info-value[property="title"]').text()).toBe(job.get('title'));
                expect($('.g-job-info-value[property="when"]').text()).toContain('January 12, 2015');
                expect($('.g-job-status-badge').text()).toContain('Inactive');

                expect($('.g-timeline-segment').length).toBe(3);
                expect($('.g-timeline-point').length).toBe(4);
                expect($('.g-timeline-start-label').text()).toBe('0 s');
                expect($('.g-timeline-end-label').text()).toBe('12 s');
                expect($('.g-timeline-point')[3].className).toContain('g-job-color-success');

                // Make sure view change happens when notification is sent for this job
                girder.eventStream.trigger('g:event.job_status', {
                    data: {
                        _id: 'foo',
                        status: girder.jobs_JobStatus.SUCCESS
                    }
                });

                expect($('.g-job-status-badge').text()).toContain('Success');

                // Make sure view change only happens for the currently viewed job
                girder.eventStream.trigger('g:event.job_status', {
                    data: {
                        _id: 'bar',
                        status: girder.jobs_JobStatus.QUEUED
                    }
                });

                expect($('.g-job-status-badge').text()).toContain('Success');

                // Test log output events
                girder.eventStream.trigger('g:event.job_log', {
                    data: {
                        _id: 'foo',
                        overwrite: true,
                        text: 'overwritten log'
                    }
                });
                expect($('.g-monospace-viewer[property="log"]').text()).toBe('overwritten log');

                girder.eventStream.trigger('g:event.job_log', {
                    data: {
                        _id: 'foo',
                        overwrite: false,
                        text: '<script type="text/javascript">xss probe!</script>'
                    }
                });

                expect($('.g-monospace-viewer[property="log"]').text()).toBe(
                    'overwritten log<script type="text/javascript">xss probe!</script>');
            });
        });
    });

    describe('Unit test the job list widget.', function () {
        it('Show a job list widget.', function () {
            var jobs, rows;

            runs(function () {
                jobs = _.map([1, 2, 3], function (i) {
                    return new girder.models.JobModel({
                        _id: 'foo' + i,
                        title: 'My batch job ' + i,
                        status: i,
                        updated: '2015-01-12T12:00:0' + i,
                        created: '2015-01-12T12:00:0' + i,
                        when: '2015-01-12T12:00:0' + i
                    });
                });

                var widget = new girder.views.jobs_JobListWidget({
                    el: $('#g-app-body-container'),
                    filter: {},
                    parentView: app
                }).render();

                expect($('.g-jobs-list-table>tbody>tr').length).toBe(0);

                // Add the jobs to the collection
                widget.collection.add(jobs);
            });

            waitsFor(function () {
                return $('.g-jobs-list-table>tbody>tr').length === 3;
            }, 'job list to auto-reload when collection is updated')

            runs(function () {
                // Make sure we are in reverse chronological order
                rows = $('.g-jobs-list-table>tbody>tr');
                expect($(rows[0]).text()).toContain('My batch job 3');
                expect($(rows[0]).text()).toContain('Success');
                expect($(rows[1]).text()).toContain('My batch job 2');
                expect($(rows[1]).text()).toContain('Running');
                expect($(rows[2]).text()).toContain('My batch job 1');
                expect($(rows[2]).text()).toContain('Queued');

                // Simulate an SSE notification that changes a job status
                girder.eventStream.trigger('g:event.job_status', {
                    data: _.extend({}, jobs[0].attributes, {
                        status: 4
                    })
                });
            });

            // Table row should update automatically
            waitsFor(function () {
                return $('td.g-job-status-cell', rows[2]).text() === 'Error';
            });
        });
        it('Job list widget filter by status.', function () {
          var jobs, rows, widget, evt = {};

          runs(function () {
              jobs = _.map([1, 2, 3], function (i) {
                  return new girder.models.JobModel({
                      _id: 'foo' + i,
                      title: 'My batch job ' + i,
                      status: i,
                      updated: '2015-01-12T12:00:0' + i,
                      created: '2015-01-12T12:00:0' + i,
                      when: '2015-01-12T12:00:0' + i
                  });
              });

              widget = new girder.views.jobs_JobListWidget({
                  el: $('#g-app-body-container'),
                  filter: {},
                  parentView: app
              }).render();

              expect($('.g-jobs-list-table>tbody>tr').length).toBe(0);

              // Add the jobs to the collection
              widget.collection.add(jobs);
          });

          waitsFor(function () {
              return $('.g-jobs-list-table>tbody>tr').length === 3;
          }, 'job list to auto-reload when collection is updated')

          runs(function () {
              // Make sure we are in reverse chronological order
              rows = $('.g-jobs-list-table>tbody>tr');
              expect($(rows[0]).text()).toContain('My batch job 3');
              expect($(rows[0]).text()).toContain('Success');
              expect($(rows[1]).text()).toContain('My batch job 2');
              expect($(rows[1]).text()).toContain('Running');
              expect($(rows[2]).text()).toContain('My batch job 1');
              expect($(rows[2]).text()).toContain('Queued');

              // Trigger event to filter out jobs in state 1 and 2
              evt[girder.jobs_JobStatus.text(1)] = false
              evt[girder.jobs_JobStatus.text(2)] = false
              evt[girder.jobs_JobStatus.text(3)] = true
              widget.filterStatusMenuWidget.trigger('g:triggerCheckBoxMenuChanged', evt);
          });

          // Table should now only contain jobs in state 3
          waitsFor(function () {
              return $('.g-jobs-list-table>tbody>tr').length === 1;
          }, 'job list to be filtered');

          runs(function () {
            // Make sure we only get the successful jobs ( state 3 )
            rows = $('.g-jobs-list-table>tbody>tr');
            expect($(rows[0]).text()).toContain('My batch job 3');
            expect($(rows[0]).text()).toContain('Success');

            // Trigger event to include jobs in state 1 and 2
            evt[girder.jobs_JobStatus.text(1)] = true
            evt[girder.jobs_JobStatus.text(2)] = true
            widget.filterStatusMenuWidget.trigger('g:triggerCheckBoxMenuChanged', evt);
          });

          // Table should now have all the jobs again
          waitsFor(function () {
              return $('.g-jobs-list-table>tbody>tr').length === 3;
          }, 'job list to be filtered');

          runs(function () {
            rows = $('.g-jobs-list-table>tbody>tr');
            expect($(rows[0]).text()).toContain('My batch job 3');
            expect($(rows[0]).text()).toContain('Success');
            expect($(rows[1]).text()).toContain('My batch job 2');
            expect($(rows[1]).text()).toContain('Running');
            expect($(rows[2]).text()).toContain('My batch job 1');
            expect($(rows[2]).text()).toContain('Queued');
          });
      });
      it('Job list widget filter by type.', function () {
        var jobs, rows, widget, evt;

        runs(function () {
            jobs = _.map(['one', 'two', 'three'], function (t, i) {
                return new girder.models.JobModel({
                    _id: 'foo' + i,
                    title: 'My batch job ' + i,
                    status: i,
                    type: t,
                    updated: '2015-01-12T12:00:0' + i,
                    created: '2015-01-12T12:00:0' + i,
                    when: '2015-01-12T12:00:0' + i
                });
            });

            widget = new girder.views.jobs_JobListWidget({
                el: $('#g-app-body-container'),
                filter: {},
                parentView: app
            }).render();

            expect($('.g-jobs-list-table>tbody>tr').length).toBe(0);

            // Add the jobs to the collection
            widget.collection.add(jobs);
        });

        waitsFor(function () {
            return $('.g-jobs-list-table>tbody>tr').length === 3;
        }, 'job list to auto-reload when collection is updated')

        runs(function () {
            rows = $('.g-jobs-list-table>tbody>tr');
            expect($(rows[0]).text()).toContain('My batch job 2');
            expect($(rows[0]).text()).toContain('three');
            expect($(rows[1]).text()).toContain('My batch job 1');
            expect($(rows[1]).text()).toContain('two');
            expect($(rows[2]).text()).toContain('My batch job 0');
            expect($(rows[2]).text()).toContain('one');

            // Trigger event to filter out jobs of type 'two' and 'three'
            evt = {
                one: true,
                two: false,
                three: false
            };
            widget.filterTypeMenuWidget.trigger('g:triggerCheckBoxMenuChanged', evt);
        });

        // Table should now only contain jobs of type 'one'
        waitsFor(function () {
            return $('.g-jobs-list-table>tbody>tr').length === 1;
        }, 'job list to be filtered');

        runs(function () {
          // Make sure we only get the jobs of type 'one'
          rows = $('.g-jobs-list-table>tbody>tr');
          expect($(rows[0]).text()).toContain('My batch job 0');
          expect($(rows[0]).text()).toContain('one');

          // Trigger event to include jobs of type 'two' and 'three'
          evt['two'] = true
          evt['three'] = true
          widget.filterTypeMenuWidget.trigger('g:triggerCheckBoxMenuChanged', evt);
        });

        // Table should now have all the jobs again
        waitsFor(function () {
            return $('.g-jobs-list-table>tbody>tr').length === 3;
        }, 'job list to be filtered');

        runs(function () {
          rows = $('.g-jobs-list-table>tbody>tr');
          expect($(rows[0]).text()).toContain('My batch job 2');
          expect($(rows[0]).text()).toContain('three');
          expect($(rows[1]).text()).toContain('My batch job 1');
          expect($(rows[1]).text()).toContain('two');
          expect($(rows[2]).text()).toContain('My batch job 0');
          expect($(rows[2]).text()).toContain('one');
        });
      });

      it('Job list widget filter by status & type.', function () {
        var jobs, rows, widget, statusEvt = {}, typeEvt = {};
        runs(function () {
            jobs = _.map(['one', 'two', 'three'], function (t, i) {
                return new girder.models.JobModel({
                    _id: 'foo' + i,
                    title: 'My batch job ' + i,
                    status: i+1,
                    type: t,
                    updated: '2015-01-12T12:00:0' + i,
                    created: '2015-01-12T12:00:0' + i,
                    when: '2015-01-12T12:00:0' + i
                });
            });

            widget = new girder.views.jobs_JobListWidget({
                el: $('#g-app-body-container'),
                filter: {},
                parentView: app
            }).render();


            expect($('.g-jobs-list-table>tbody>tr').length).toBe(0);

            // Add the jobs to the collection
            widget.collection.add(jobs);
        });

        waitsFor(function () {
            return $('.g-jobs-list-table>tbody>tr').length === 3;
        }, 'job list to auto-reload when collection is updated')

        runs(function () {
            rows = $('.g-jobs-list-table>tbody>tr');
            expect($(rows[0]).text()).toContain('My batch job 2');
            expect($(rows[0]).text()).toContain('three');
            expect($(rows[1]).text()).toContain('My batch job 1');
            expect($(rows[1]).text()).toContain('two');
            expect($(rows[2]).text()).toContain('My batch job 0');
            expect($(rows[2]).text()).toContain('one');

            // Trigger event to filter out jobs of type 'two' and 'three'
            typeEvt = {
                one: true,
                two: false,
                three: false
            };
            widget.filterTypeMenuWidget.trigger('g:triggerCheckBoxMenuChanged', typeEvt);

            // Trigger event to filter out jobs in state 1 and 3
            statusEvt[girder.jobs_JobStatus.text(1)] = false
            statusEvt[girder.jobs_JobStatus.text(2)] = true
            statusEvt[girder.jobs_JobStatus.text(3)] = false
            widget.filterStatusMenuWidget.trigger('g:triggerCheckBoxMenuChanged', statusEvt);
        });

        // Table should be empty
        waitsFor(function () {
            return $('.g-jobs-list-table>tbody>tr').length === 0;
        }, 'job list to be filtered');

        runs(function () {

          // Trigger event to include jobs of type 'one'
          typeEvt['one'] = true
          widget.filterTypeMenuWidget.trigger('g:triggerCheckBoxMenuChanged', typeEvt);

          // Trigger event to include jobs in state 1
          statusEvt[girder.jobs_JobStatus.text(1)] = true
          widget.filterStatusMenuWidget.trigger('g:triggerCheckBoxMenuChanged', statusEvt);
        });

        // Table should have one job
        waitsFor(function () {
            return $('.g-jobs-list-table>tbody>tr').length === 1;
        }, 'job list to be filtered');

        runs(function () {
          rows = $('.g-jobs-list-table>tbody>tr');
          expect($(rows[0]).text()).toContain('My batch job 0');
          expect($(rows[0]).text()).toContain('one');
          expect($(rows[0]).text()).toContain('1');
        });
      });
    });
});
