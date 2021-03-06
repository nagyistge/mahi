/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var transform = require('../lib/replicator/transforms/groupofuniquenames.js');

var redis = require('fakeredis');
var REDIS;

var nodeunit = require('nodeunit-plus');
var vasync = require('vasync');
var test = nodeunit.test;

test('setup', function (t) {
    REDIS = redis.createClient();
    t.done();
});

test('add - single user', function (t) {
    var entry = {
        'dn': 'changenumber=14, cn=changelog',
        'controls': [],
        'targetdn': 'cn=operators, ou=groups, o=smartdc',
        'changetype': 'add',
        'objectclass': 'changeLogEntry',
        'changetime': '2013-12-03T18:29:25.272Z',
        'changes': {
            'objectclass': [
                'groupofuniquenames'
            ],
            'uniquemember': [
                'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
                    'ou=users, o=smartdc'
            ],
            '_parent': [
                'ou=groups, o=smartdc'
            ]
        },
        'changenumber': '14'
    };

    var args = {
        changes: entry.changes,
        entry: entry,
        log: this.log,
        redis: REDIS
    };

    var user = '930896af-bf8c-48d4-885c-6573a94b1853';
    var key = '/uuid/' + user;
    var value = JSON.stringify({'groups':['operators']});

    transform.add(args, function (err, res) {
        t.equal(3, res.queue.length);
        t.deepEqual(res.queue[1][0], 'sadd');
        t.deepEqual(res.queue[2], [
            'set',
            key,
            value
        ]);
        res.exec(function () {
            REDIS.get(key, function (err, res) {
                t.strictEqual(value, res);
                REDIS.sismember('/uuid/operators/groups', user,
                        function (err, res) {
                    t.strictEqual(res, 1);
                    t.done();
                });
            });
        });
    });
});


test('add - multiple users', function (t) {
    var entry = {
        'dn': 'changenumber=14, cn=changelog',
        'controls': [],
        'targetdn': 'cn=admins, ou=groups, o=smartdc',
        'changetype': 'add',
        'objectclass': 'changeLogEntry',
        'changetime': '2013-12-03T18:29:25.272Z',
        'changes': {
            'objectclass': [
                'groupofuniquenames'
            ],
            'uniquemember': [
                'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
                    'ou=users, o=smartdc',
                'uuid=1a940615-65e9-4856-95f9-f4c530e86ca4, ' +
                    'ou=users, o=smartdc'
            ],
            '_parent': [
                'ou=groups, o=smartdc'
            ]
        },
        'changenumber': '14'
    };

    var args = {
        changes: entry.changes,
        entry: entry,
        log: this.log,
        redis: REDIS
    };

    var user1 = '930896af-bf8c-48d4-885c-6573a94b1853';
    var user2 = '1a940615-65e9-4856-95f9-f4c530e86ca4';
    var key1 = '/uuid/' + user1;
    var key2 = '/uuid/' + user2;
    var value1 = JSON.stringify({
        'groups': [ 'admins', 'operators' ]
    });
    var value2 = JSON.stringify({'groups':['admins']});

    transform.add(args, function (err, res) {
        t.equal(5, res.queue.length);
        t.deepEqual(res.queue[3], [
            'set',
            key1,
            value1
        ]);
        t.deepEqual(res.queue[4], [
            'set',
            key2,
            value2
        ]);
        res.exec(function () {
            REDIS.get(key1, function (err, res) {
                t.strictEqual(value1, res);
                REDIS.get(key2, function (err2, res2) {
                    t.strictEqual(value2, res2);
                    REDIS.sismember('/uuid/admins/groups', user1,
                        function (err, res) {

                        t.strictEqual(res, 1);
                        REDIS.sismember('/uuid/admins/groups', user2,
                            function (err, res) {

                            t.strictEqual(res, 1);
                            t.done();
                        });
                    });
                });
            });
        });
    });
});

test('add - empty group', function (t) {
    var entry = {
        'dn': 'changenumber=14, cn=changelog',
        'controls': [],
        'targetdn': 'cn=empty, ou=groups, o=smartdc',
        'changetype': 'add',
        'objectclass': 'changeLogEntry',
        'changetime': '2013-12-03T18:29:25.272Z',
        'changes': {
            'objectclass': [
                'groupofuniquenames'
            ],
            '_parent': [
                'ou=groups, o=smartdc'
            ]
        },
        'changenumber': '14'
    };

    var args = {
        changes: entry.changes,
        entry: entry,
        log: this.log,
        redis: REDIS
    };

    transform.add(args, function (err, res) {
        t.equal(1, res.queue.length); // only one element: 'MULTI'
        res.exec(function () {
            t.done();
        });
    });
});

test('modify', function (t) {
    var entry = {
        'dn': 'changenumber=15, cn=changelog',
        'controls': [],
        'targetdn': 'cn=operators, ou=groups, o=smartdc',
        'changetype': 'modify',
        'objectclass': 'changeLogEntry',
        'changetime': '2013-12-10T19:23:21.228Z',
        'changes': [
            {
                'operation': 'add',
                'modification': {
                    'type': 'uniquemember',
                    'vals': [
                        'uuid=a820621a-5007-4a2a-9636-edde809106de, ' +
                            'ou=users, o=smartdc',
                        'uuid=1a940615-65e9-4856-95f9-f4c530e86ca4, ' +
                            'ou=users, o=smartdc'
                    ]
                }
            }
        ],
        'entry': JSON.stringify({
            'objectclass': [
                'groupofuniquenames'
            ],
            'uniquemember': [
                'uuid=1a940615-65e9-4856-95f9-f4c530e86ca4, ' +
                    'ou=users, o=smartdc',
                'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
                    'ou=users, o=smartdc',
                'uuid=a820621a-5007-4a2a-9636-edde809106de, ' +
                    'ou=users, o=smartdc'
            ],
            '_parent': [
                'ou=groups, o=smartdc'
            ]
        }),
        'changenumber': '15'
    };

    var key1 = '/uuid/1a940615-65e9-4856-95f9-f4c530e86ca4';
    var key2 = '/uuid/930896af-bf8c-48d4-885c-6573a94b1853';
    var key3 = '/uuid/a820621a-5007-4a2a-9636-edde809106de';

    var args = {
        changes: entry.changes,
        entry: entry,
        log: this.log,
        redis: REDIS
    };

    transform.modify(args, function (err, res) {
        t.strictEqual(5, res.queue.length);
        res.exec(function () {
            var barrier = vasync.barrier();
            barrier.start('1');
            barrier.start('2');
            barrier.start('3');
            barrier.on('drain', function () {
                t.done();
            });
            REDIS.get(key1, function (err, res) {
                t.ok(JSON.parse(res).groups.indexOf('operators') >= 0);
                t.ok(JSON.parse(res).groups.indexOf('admins') >= 0);
                barrier.done('1');
            });
            REDIS.get(key2, function (err, res) {
                t.ok(JSON.parse(res).groups.indexOf('operators') >= 0);
                t.ok(JSON.parse(res).groups.indexOf('admins') >= 0);
                barrier.done('2');
            });
            REDIS.get(key3, function (err, res) {
                t.ok(JSON.parse(res).groups.indexOf('operators') >= 0);
                barrier.done('3');
            });
        });
    });
});

test('modify - replace', function (t) {
    var entry = {
        'dn': 'changenumber=15, cn=changelog',
        'controls': [],
        'targetdn': 'cn=operators, ou=groups, o=smartdc',
        'changetype': 'modify',
        'objectclass': 'changeLogEntry',
        'changetime': '2013-12-10T19:23:21.228Z',
        'changes': [
            {
                'operation': 'replace',
                'modification': {
                    'type': 'uniquemember',
                    'vals': [
                        'uuid=1a940615-65e9-4856-95f9-f4c530e86ca4, ' +
                            'ou=users, o=smartdc'
                    ]
                }
            }
        ],
        'entry': JSON.stringify({
            'objectclass': [
                'groupofuniquenames'
            ],
            'uniquemember': [
                'uuid=1a940615-65e9-4856-95f9-f4c530e86ca4, ' +
                    'ou=users, o=smartdc'
            ],
            '_parent': [
                'ou=groups, o=smartdc'
            ]
        }),
        'changenumber': '15'
    };

    var key1 = '/uuid/1a940615-65e9-4856-95f9-f4c530e86ca4';
    var key2 = '/uuid/930896af-bf8c-48d4-885c-6573a94b1853';
    var key3 = '/uuid/a820621a-5007-4a2a-9636-edde809106de';

    var args = {
        changes: entry.changes,
        entry: entry,
        log: this.log,
        redis: REDIS
    };

    transform.modify(args, function (err, res) {
        t.strictEqual(5, res.queue.length);
        res.exec(function () {
            var barrier = vasync.barrier();
            barrier.start('1');
            barrier.start('2');
            barrier.start('3');
            barrier.on('drain', function () {
                t.done();
            });
            REDIS.get(key1, function (err, res) {
                t.ok(JSON.parse(res).groups.indexOf('operators') >= 0);
                t.ok(JSON.parse(res).groups.indexOf('admins') >= 0);
                barrier.done('1');
            });
            REDIS.get(key2, function (err, res) {
                t.ok(JSON.parse(res).groups.indexOf('operators') < 0);
                t.ok(JSON.parse(res).groups.indexOf('admins') >= 0);
                barrier.done('2');
            });
            REDIS.get(key3, function (err, res) {
                t.ok(JSON.parse(res).groups.indexOf('operators') < 0);
                t.ok(JSON.parse(res).groups.indexOf('admins') < 0);
                barrier.done('3');
            });
        });
    });
});

test('delete', function (t) {
    var entry = {
        'dn': 'changenumber=16, cn=changelog',
        'controls': [],
        'targetdn': 'cn=operators, ou=groups, o=smartdc',
        'changetype': 'delete',
        'objectclass': 'changeLogEntry',
        'changetime': '2013-12-10T19:25:23.214Z',
        'changes': {
            'objectclass': [
                'groupofuniquenames'
            ],
            'uniquemember': [
                'uuid=1a940615-65e9-4856-95f9-f4c530e86ca4, ' +
                    'ou=users, o=smartdc',
                'uuid=930896af-bf8c-48d4-885c-6573a94b1853, ' +
                    'ou=users, o=smartdc',
                'uuid=a820621a-5007-4a2a-9636-edde809106de, ' +
                    'ou=users, o=smartdc',
                'uuid=f445c6e2-61e9-11e3-a740-03049cda7ff9, ' +
                    'ou=users, o=smartdc'
            ],
            '_parent': [
                'ou=groups, o=smartdc'
            ]
        },
        'changenumber': '16'
    };

    var args = {
        changes: entry.changes,
        entry: entry,
        log: this.log,
        redis: REDIS
    };

    var key1 = '/uuid/1a940615-65e9-4856-95f9-f4c530e86ca4';
    var key2 = '/uuid/930896af-bf8c-48d4-885c-6573a94b1853';
    var key3 = '/uuid/a820621a-5007-4a2a-9636-edde809106de';
    var key4 = '/uuid/f445c6e2-61e9-11e3-a740-03049cda7ff9';
    var value = JSON.stringify({groups: ['admins'] });

    transform.delete(args, function (err, res) {
        t.equal(10, res.queue.length);
        t.deepEqual(res.queue[5], [
            'set',
            key1,
            value
        ]);
        t.deepEqual(res.queue[6], [
            'set',
            key2,
            value
        ]);
        res.exec(function () {
            var barrier = vasync.barrier();
            barrier.start('1');
            barrier.start('2');
            barrier.start('3');
            barrier.start('4');
            barrier.on('drain', function () {
                t.done();
            });
            REDIS.get(key1, function (err, res) {
                t.strictEqual(res, value);
                barrier.done('1');
            });
            REDIS.get(key2, function (err, res) {
                t.strictEqual(res, value);
                barrier.done('2');
            });
            REDIS.get(key3, function (err, res) {
                t.strictEqual(res, JSON.stringify({groups: []}));
                barrier.done('3');
            });
            REDIS.get(key4, function (err, res) {
                t.strictEqual(res, JSON.stringify({groups: []}));
                barrier.done('4');
            });
        });
    });
});
