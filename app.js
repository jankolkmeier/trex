var express = require('express'),
    io      = require('socket.io'),
    Mysql   = require('mysql').Client,
    config  = require('./config.js').Config,
    exec    = require('child_process').exec,
    form    = require('connect-form'),
    im      = require('imagemagick'),
    email   = require('emailjs'),
    crypto  = require('crypto');

var app = express.createServer(
    form({ keepExtensions: true})
);

var server = io.listen(app);

var tweet = function(msg) {
    var out = exec(config.twitterClient+' "'+msg+'"', function (error, stdout, stderr) {
      if (error !== null) {
        console.log('exec error: ' + error);
      }
    });
    return;
}

var sendMail = function(to, subj, msg) {
    var server = email.server.connect(config.mail);
    server.send({
        text: msg,
        from: "T-Rex <createuberbox@gmail.com>",
        to: to,
        subject: subj
    }, function(err, message) {
        if (err) console.log(err);
    });
};
var notifyGroup = function(gid, subj, msg, icon) {
    var query = "SELECT id FROM usrgrp WHERE isgroup = ? "+
        "AND id IN (SELECT usrId FROM connection WHERE usrgrpId = ?);";
    mysql.query(query, [false, gid], function(error, results, fields) {
        if (!error) {
            for (var i=0; i<results.length; i++) {
                for (var j=0; j<listeners.length; j++) {
                    if(results[i]['id']===listeners[j][0]) {
                        listeners[j][1].send({ action:"_notify",
                            heading:subj,
                            icon: icon,
                            msg:msg
                        });
                    }
                }
            }
        } else {
            console.log(error.message);
        }
    });
}
var sendToGroup = function(gid, subj, msg, not) {
    var query = "SELECT mail FROM usrgrp WHERE isgroup = ? "+
        "AND notifyMail = ? "+
        "AND id != ? "+
        "AND id IN (SELECT usrId FROM connection WHERE usrgrpId = ?);";
    mysql.query(query, [false, true, not, gid], function(error, results, fields) {
        if (!error) {
            var ccs = "";
            for (var i=0; i<results.length; i++) {
                ccs += results[i]['mail']+", "; 
            }
            console.log(ccs);
            return;
            sendMail(ccs, subj, msg);
        } else {
            console.log(error.message);
        }
    });
}

var randomString = function(length) {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var randomstring = '';
    for (var i=0; i<length; i++) {
    	var rnum = Math.floor(Math.random() * chars.length);
    	randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring;
}

var listeners = [];

mysql = new Mysql();

mysql.user = config.mysqlUser;
mysql.password = config.mysqlPass;
mysql.database = config.mysqlDB;
mysql.host = config.mysqlHost;
mysql.connect();

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/static'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: "askjhqowdksahdwau", store: 
    new express.session.MemoryStore({ reapInterval: 60000 * 10 })
}));


app.get('/', function(req, res){
    var userid = "undefined";
    if (req.session.user) {
        userid = req.session.user['id']
    }
    res.render('canvas', { locals: { userid: userid }});
});

app.get('/settings', function(req, res){
    if (!req.session.user)
        res.redirect('/');
    else {
        var userid = req.session.user['id']
        res.render('index', { locals: { userid: userid }});
    }
});

app.get('/register', function(req, res){
    if (req.session.user)
        res.redirect('/');
    else {
        var userid = "undefined";
        res.render('register', { locals: { userid: userid }});
    }
});

var login = function(req, res) {
    var pass = crypto.createHash('md5').update(req.body.pass).digest('hex'); 
    var query = "SELECT id,name,icon FROM usrgrp WHERE "+
        "mail = ? AND pass = ? AND isgroup = ?;";
    var values = [
        req.body.mail,
        pass,
        false
    ]
    mysql.query(query, values, function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else if (results.length!=1) {
            res.send({success:false, error:"unknown user/pass"});
        } else {
            req.session.user = results[0];
            res.send({success:true, user:results[0]});
        }
    });
}

var makeconnection = function(req, res) {
    if (!req.session.user) return res.send({success:false, error:"not authed"});
    if (req.body.group && !req.body.usrgrpid)
        req.body.usrgrpid = req.body.group;
    var query = "INSERT INTO connection (usrId, usrgrpId) "+
        "VALUES (?, ?)"; 
    var values = [
       req.session.user['id'],
       req.body.usrgrpid
    ];
    mysql.query(query, values, function(error) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            req.body.type = "Collecton";
            req.body.amount = 1;
            req.body.reason = req.body.msg;
            sendreward(req, res);
        }
    });
}

var breakconnection = function(req, res) {
    if (!req.session.user) return res.send({success:false, error:"not authed"});
    var query = "DELETE FROM connection "+
        "WHERE usrId = ? AND usrgrpId = ?;";
    var values = [
        req.session.user['id'],
        req.body.usrgrpid
    ]
    mysql.query(query, values, function(error) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            res.send({success:true});
        }
    });
}

var sendreward = function(req, res) {
    if (!req.session.user) return res.send({success:false, error:"not authed"});
    var query = "INSERT INTO reward "+
        "(fromId, toId, type, amount, reason) "+
        "VALUES (?, ?, ?, ?, ?);";
    var values = [
        req.session.user['id'],
        req.body.usrgrpid,
        req.body.type,
        Math.min(parseInt(req.body.amount),50),
        req.body.reason
    ];

    mysql.query(query, values, function(error, info) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            var query = "SELECT DISTINCT r.id,r.date,r.type,r.amount,r.reason, "+
                    "f.id AS fId, f.name AS fName, f.isgroup AS fIsGroup, f.icon AS fIcon, "+
                    "t.id AS tId, t.name AS tName, t.isgroup AS tIsGroup, t.icon AS tIcon, "+
                    "t.twitter AS tTwitter, t.notifyTwitter AS tNotifyTwitter, "+
                    "t.mail AS tMail, t.notifyMail AS tNotifyMail "+
                "FROM reward r, usrgrp f, usrgrp t, usrgrp c "+
                "WHERE f.id = r.fromId AND "+
                    "t.id = r.toId AND "+
                    "r.id = ? ";
            mysql.query(query, [info.insertId], function(error, results, fields) {
                if (!error && results.length==1) {
                    var from = results[0]['fName'];
                    var to = results[0]['tName'];
                    var amount = parseInt(results[0]['amount']);
                    var type = results[0]['type']+((amount>1) ? "s" : "");
                    var reason = results[0]['reason'];

                    var selfsend = results[0]['tId']===results[0]['fId'];
                    
                    if (amount>=50) amount = "a lot"

                    if (selfsend) to = "her/himself";
                    var twit = from+" sent "+amount+" "+type+" "+
                        " to "+to+": "+reason;
                    if (results[0]['tTwitter'] && results[0]['tNotifyTwitter'])
                        twit = "@"+results[0]['tTwitter']+" "+twit;
                    tweet(twit.substring(0, 139));
                    var topic = "You got "+amount+" "+type;
                    var msgSingle = "Hey "+to+", you got "+amount+" "+type+
                        " from "+from+"!\r\n"+
                        "Reason:\r\n"+reason;
                    if (selfsend) msgSingle = "Hey, you just got "+amount+" "+type+
                        " from yourself!\r\nReason:\r\n"+reason;
                    if (results[0]['tIsGroup']) {
                        var msg = "Hey, your group "+to+" just got "+amount+
                        " "+type+" from "+from+"!\r\n"+
                        " Reason:\r\n"+reason;
                        sendToGroup(
                            parseInt(results[0]['tId']),
                            topic, msg,
                            parseInt(results[0]['fId'])
                        );
                        notifyGroup(parseInt(results[0]['tId']),
                            topic, msg, results[0]['type']);
                    } else if (!selfsend && results[0]['tNotifyMail']) {
                        sendMail(results[0]['tMail'], topic, msgSingle);
                    }
                    for (var j=0; j<listeners.length; j++) {
                        if(results[0]['tId']===listeners[j][0]) {
                            listeners[j][1].send({ action:"_notify",
                                heading:topic,
                                msg:msgSingle,
                                icon:results[0]['type']
                            });
                            return;
                        }
                    }
                }
            });
            res.send({success:true});
        }
    });
}

app.post('/createaccount', function(req, res) {
    var pass = crypto.createHash('md5').update(req.body.pass).digest('hex'); 
    var query = "INSERT INTO usrgrp "+
        "SET name = ?, pass = ?, mail = ?, twitter = ?, msg = ?, isgroup = ? ";
    var values = [
        req.body.name,
        pass,
        req.body.mail,
        req.body.twitter,
        req.body.msg,
        0
    ];
    mysql.query(query, values, function(error) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            login(req, res);
        }
    });
});

app.get('/updatenotify', function(req, res) {
    if (!req.session.user) return res.send({success:false, error:"not authed"});
    var query = "SELECT notifyTwitter,notifyMail FROM usrgrp "+
        "WHERE id = ?;";
    var values = [
        req.session.user['id']
    ];
    mysql.query(query, values, function(error, results, fields) {
        if (error) {
            res.send({ success:false, error:error+"" });
        } else {
            res.send({ success:true, notify:results[0] });
        }
    });
});

app.post('/updatenotify', function(req, res) {
    if (!req.session.user) return res.send({success:false, error:"not authed"});
    var query = "UPDATE usrgrp "+
        "SET notifyTwitter = ?, notifyMail = ? "+
        "WHERE id = ? ;";
    var values = [ 0, 0, req.session.user['id']];
    if (req.body) {
        values[0] = (req.body.twitter) ? 1 : 0;
        values[1] = (req.body.mail) ? 1 : 0;
    }
    mysql.query(query, values, function(error) {
        if (error) {
            res.send({ success:false, error:error+"" });
        } else {
            res.send({ success:true });
        }
    });
});

app.post('/creategroup', function(req, res) {
    if (!req.session.user) return res.send({success:false, error:"not authed"});
    var query = "INSERT INTO usrgrp "+
        "(name, msg, isgroup) "+
        "VALUES (?, ?, ?)";
    var values = [
        req.body.group,
        req.body.msg,
        true
    ];
    mysql.query(query, values, function(error, info) {
        if (error) {
            res.send({success:false, error:error+""});
        } else if (req.body.join) {
            req.body.group = info.insertId;
            makeconnection(req, res);
        } else {
            res.send({success:true});
        }
    });
});

app.post('/joingroup', makeconnection);

app.post('/leavegroup', breakconnection);

app.post('/sendreward', sendreward);

app.post('/login', login);

app.post('/settings', function(req, res) {
    // convert img.jpg -crop [A]x[A]+[SOx]+[SOy] -scale 101x101 out.png
    //convert out.png mask.png -alpha Off -compose CopyOpacity -composite cropped.png

});

app.post('/uploadavatar', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }
    req.form.complete(function(err, fields, files){
        if (err) {
            next(err);
        } else {
            var out = files.image.path.split('/')[2];
            var dest = __dirname+"/static/tmp/";
            exec('mv '+files.image.path+' '+dest, function(err, stoud, stderr) {
                if (err) res.send("something went wrong");
                else res.redirect('/editavatar/'+fields.id+'/'+out);
            });
        }
    });
});

app.get('/editavatar/:id/:temp', function(req,res) {
    if (!req.session.user) {
        return res.redirect('/');
    } else {
        userid = req.session.user['id'];
    }
    res.render('editavatar', {
        locals: {
            img: req.params.temp,
            userid: userid
        }
    });
});

app.post('/editavatar/:id/:temp', function(req, res) {
    if (!req.session.user) {
        return res.redirect('/');
    }
    var name = "/img/"+randomString(8)+".png";
    var pref = __dirname+"/static";
    var args = [
        pref+'/tmp/'+req.params.temp,
        '-crop',
        req.body.a+'x'+req.body.a+'+'+req.body.xoff+'+'+req.body.yoff,
        '-scale', '101x101',
        __dirname+"/resources/mask.png",
        '-alpha', 'Off',
        '-compose', 'CopyOpacity',
        '-composite', pref+name
    ];
    im.convert(args, function(err, meta) {
        if (err) res.send("something went wrong:"+err);
        else {
            var query = "UPDATE usrgrp SET icon = ? WHERE id = ?;";
            var values = [
                name,
                req.params.id
            ];
            mysql.query(query, values, function(error, info) {
                if (error) {
                    res.send({success:false, error:error+""});
                } else {
                    res.redirect('/usrgrp/'+req.params.id);
                }
            });
        }
    });
});

app.get('/logout', function(req, res) {
    delete req.session.user;
    res.redirect('/');
});

var getRelevantRewards = function(id, t, cb) {
    var query = "SELECT DISTINCT r.id,r.date,r.type,r.amount,r.reason, "+
            "f.id AS fId, f.name as fName, f.isgroup as fIsGroup, "+
            "t.id AS tId, t.name as tName, t.isgroup as tIsGroup "+
        "FROM reward r, usrgrp f, usrgrp t, usrgrp c "+
        "WHERE (f.id = r.fromId AND "+
            "t.id = r.toId AND "+
            "TIMESTAMPDIFF(DAY, NOW(), date) < ?) AND ("+
            "t.id = ? OR ("+
            "t.isgroup AND t.id IN (SELECT usrgrpId FROM connection "+
                "WHERE usrId = ?))) "+
        "ORDER BY r.date ASC";
    var values = [
        t,
        id,
        id
    ];

    mysql.query(query, values, function(error,results,fields) {
        if (error) cb([]);
        else cb(results);
    });
};

app.get('/usrgrp/:id', function(req, res) {
    var userid = "undefined";
    if (req.session.user) {
        userid = req.session.user['id']
    }
    var query = "SELECT * FROM usrgrp WHERE id = ?";
    mysql.query(query, [req.params.id], function(error,results,fields) {
        if (!error) getRelevantRewards(req.params.id, 21, function(rewards) {
            res.render('usrgrp', {
                locals: {
                    userid: userid,
                    usrgrp: results[0],
                    rewards: rewards 
                }
            });
        }); 
        else res.write("not found");
    });
});

app.get('/api/rewards', function(req, res) {
    var query = "SELECT DISTINCT r.id,r.date,r.type,r.amount,r.reason, "+
            "f.id AS fId, f.name as fName, f.isgroup as fIsGroup, "+
            "t.id AS tId, t.name as tName, t.isgroup as tIsGroup "+
        "FROM reward r, usrgrp f, usrgrp t, usrgrp c "+
        "WHERE f.id = r.fromId AND "+
            "t.id = r.toId "+
        "LIMIT 30;";
    mysql.query(query, function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            res.send({success:true, rewards:results});
        }
    });
});

app.get('/api/users', function(req, res) {
    var query = "SELECT id,name,icon FROM usrgrp WHERE isgroup = ? ORDER BY name ASC;";
    mysql.query(query, [false], function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            res.send({success:true, users:results});
        }
    });
});

app.get('/api/groups', function(req, res) {
    var query = "SELECT id,name,msg,icon FROM usrgrp "+
        "WHERE isgroup = ? ORDER BY Name ASC;";
    mysql.query(query, [true], function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            res.send({success:true, groups:results});
        }
    });
});

app.get('/api/user/:id', function(req, res) {
    var query = "SELECT id,msg,name,icon,isgroup FROM usrgrp "+
        "WHERE isgroup = ? AND id = ?;";
    var values = [
        false,
        req.params.id
    ]
    mysql.query(query, values, function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else if (results.length!=1) {
            res.send({success:false, error:"unknown userid"});
        } else {
            res.send({success:true, user:results[0]});
        }
    });
});

var getusergroups = function(req, res) {
    var not = (req.notmemberof) ? "NOT " : "";
    var query = "SELECT id,name,msg,icon,isgroup FROM usrgrp "+
        "WHERE isgroup = ? AND id "+not+"IN "+
        "(SELECT usrgrpId FROM connection WHERE usrId = ?)";
    var values = [
        1,
        parseInt(req.params.id)
    ];
    mysql.query(query, values, function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            res.send({success:true, groups:results});
        }
    });
}

app.get('/api/user/:id/groups/notmemberof', function(req, res) {
    req.notmemberof = true;
    getusergroups(req, res);
});

app.get('/api/user/:id/groups', getusergroups);

app.get('/api/group/:id/member', function(req, res) {
    var query = "SELECT id,name,msg,icon,isgroup FROM usrgrp "+
        "WHERE isgroup = ? AND id IN "+
        "(SELECT usrId FROM connection WHERE usrgrpId = ?)"
    var values = [
        false,
        parseInt(req.params.id)
    ];
    mysql.query(query, values, function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else {
            res.send({success:true, users:results});
        }
    });
});

app.get('/api/group/:id', function(req, res) {
    var query = "SELECT id,name,icon,isgroup FROM usrgrp "+
        "WHERE isgroup = ? AND id = ?;";
    var values = [
        true,
        req.params.id
    ]
    mysql.query(query, values, function(error, results, fields) {
        if (error) {
            res.send({success:false, error:error+""});
        } else if (results.length!=1) {
            res.send({success:false, error:"unknown groupid"});
        } else {
            req.session.user = results[0];
            res.send({success:true, group:results[0]});
        }
    });
});

app.get('/showlisteners', function(req, res) {
    res.send(JSON.stringify(listeners));
});

var registerSocketClient = function(client, mail, cb) {
    var query = "SELECT id FROM usrgrp WHERE mail = ?";
    mysql.query(query, [mail], function(err, results, fields) {
        if (err) return cb({ action:"_error", msg:error.message});
        else if (results.length!=1) return cb(
            { action:"_error",
              msg:"Unknown email address. Please set it in this extension's options!"
            });
        else {
            listeners.push([results[0]['id'], client]);
            return cb({
                action:"_success",
                msg:"Registered succesfully",
                id: results[0]['id']
            });
        }
    });
};

server.on('connection', function(client) {
    client.on('message', function (msg) {
        try {
            var msgd = JSON.parse(msg);
            if (msgd.action === "_register") {
                var cl = this;
                registerSocketClient(this, msgd.email, function(res) {
                    cl.send(res);
                });
            }
        } catch(e) {
           console.log("couldn't parse msg: "); 
           console.log(msg); 
        }
    });
    client.on('disconnect', function(client){
        for (var i=0; i<listeners.length;i++) {
            if (listeners[i][1] == client) {
                listeners.splice(i,1);
                return;
            }
        }
    });
});

app.listen(config.httpPort);
