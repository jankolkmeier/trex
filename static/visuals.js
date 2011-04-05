var r = function(x) {
    return Math.random()*x-x/2;
};

var lastOver = null;
var connections = [];
var usrgrps = [];
var otherusrgrps = [];
var context;
var h1 = 50;
var h2 = 45;
var h3 = 40;
var h4 = 24;
var hRad = 150;

Raphael.fn.connection = function (obj1, obj2, line, bg) {
    if (obj1.line && obj1.from && obj1.to) {
        line = obj1;
        obj1 = line.from;
        obj2 = line.to;
    }
    var bb1 = obj1.getBBox(),
        bb2 = obj2.getBBox(),
        p = [{x: bb1.x + bb1.width / 2, y: bb1.y - 1},
        {x: bb1.x + bb1.width / 2, y: bb1.y + bb1.height + 1},
        {x: bb1.x - 1, y: bb1.y + bb1.height / 2},
        {x: bb1.x + bb1.width + 1, y: bb1.y + bb1.height / 2},
        {x: bb2.x + bb2.width / 2, y: bb2.y - 1},
        {x: bb2.x + bb2.width / 2, y: bb2.y + bb2.height + 1},
        {x: bb2.x - 1, y: bb2.y + bb2.height / 2},
        {x: bb2.x + bb2.width + 1, y: bb2.y + bb2.height / 2}],
        d = {}, dis = [];
    for (var i = 0; i < 4; i++) {
        for (var j = 4; j < 8; j++) {
            var dx = Math.abs(p[i].x - p[j].x),
                dy = Math.abs(p[i].y - p[j].y);
            if ((i == j - 4) || (((i != 3 && j != 6) || p[i].x < p[j].x) && ((i != 2 && j != 7) ||
                p[i].x > p[j].x) && ((i != 0 && j != 5) || p[i].y > p[j].y) && ((i != 1 && j != 4) ||
                p[i].y < p[j].y))) {
                dis.push(dx + dy);
                d[dis[dis.length - 1]] = [i, j];
            }
        }
    }
    if (dis.length == 0) {
        var res = [0, 4];
    } else {
        res = d[Math.min.apply(Math, dis)];
    }
    var x1 = p[res[0]].x,
        y1 = p[res[0]].y,
        x4 = p[res[1]].x,
        y4 = p[res[1]].y;
    dx = Math.max(Math.abs(x1 - x4) / 2, 10);
    dy = Math.max(Math.abs(y1 - y4) / 2, 10);
    var x2 = [x1, x1, x1 - dx, x1 + dx][res[0]].toFixed(3),
        y2 = [y1 - dy, y1 + dy, y1, y1][res[0]].toFixed(3),
        x3 = [0, 0, 0, 0, x4, x4, x4 - dx, x4 + dx][res[1]].toFixed(3),
        y3 = [0, 0, 0, 0, y1 + dy, y1 - dy, y4, y4][res[1]].toFixed(3);
    var path = ["M", x1.toFixed(3), y1.toFixed(3), "C", x2, y2, x3, y3, x4.toFixed(3), y4.toFixed(3)].join(",");
    if (line && line.line) {
        line.bg && line.bg.attr({path: path});
        line.line.attr({path: path});
    } else {
        var color = typeof line == "string" ? line : "#000";
        return {
            bg: bg && bg.split && this.path(path).attr({stroke: bg.split("|")[0], fill: "none", "stroke-width": bg.split("|")[1] || 3}),
            line: this.path(path).attr({stroke: color, fill: "none"}),
            from: obj1,
            to: obj2
        };
    }
};

startVisuals = function(canvas) {
    w = parseInt(canvas.css('width'));
    h = parseInt(canvas.css('height'));
    C = Raphael(canvas[0], w, h);
    
    var mkButton = function(x,y,color,img,desc,cb) {
        var res = C.set();
        var res_button = C.rect(x,y,60,50,6)
        .attr({
            'stroke-width': 5,
            'fill': '#fff',
            'stroke': color
        })
        var res_img = C.image(img,x+8,y+8,44,34);
        res.push(res_img);
        res.push(res_button);

        res.target = false;
        obj = {name:desc, msg:""};
        res[0].obj = obj;
        res[0].mouseover(loadTooltip);
        res[0].mouseout(function() {
            tooltip.fadeOut(100);
            lastOver = null;
        });
        res.mouseup(function() {
           cb();
        });
        return res;
    }
    
    var start = function() {
        console.log("picked "+this.obj.name);
        this.toBack();
        for (var i=0; i<this.followers.length;i++)
            this.followers[i].toBack();
        this.ox = this.attr('cx');
        this.oy = this.attr('cy');
        tooltip.fadeOut(100);
    };

    var move = function(dx, dy) {
        if(dx && dy) this.attr({cx: this.ox+dx, cy: this.oy+dy});

        var r = this.attr('r');
        var a = r*2;
        var x = this.attr('cx');
        var y = this.attr('cy');
        for (var i = 0; i<this.followers.length; i++) {
            var o = this.followers[i];

            if (o.type === 'rect' || o.type === 'image') {
                o.attr({ x: x-r, y: y-r,
                   width: a, height: a });
            }

            if (o.type == 'circle') {
                o.attr({ cx: x, cy: y, r: r});
            }

            o.insertBefore(this);
        }
        
        for (var i = connections.length; i--;) {
            C.connection(connections[i]);
        }
        if (tooltip.current === this && !this.randomMoved) tooltip.hide();
    };
    
    var restoreUp = function(fn) {
        return function() {
            var target = (lastOver!=null && lastOver!=this.obj) ? lastOver : false;
            console.log("dropped "+this.obj.name+" on "+target.name || "nothing"); 
            if(target) {
                var txt = "Sending "+this.obj.name+"(s) to "+target.name;
                var reason = prompt(txt+". Enter reason: ");
                var amounttxt = "Enter amount of "+this.obj.name+"s";
                if (reason) {
                    var amount = prompt(amounttxt,1);
                    if (amount) {
                        sendReward(target.id, this.obj.id, reason, amount, function(data) {
                            console.log(data);
                        });
                    }
                }
            }
            for (var i=0; i<this.followers.length; i++) {
                this.followers[i].remove();
            }
            this.remove();
            fn();
        };
    }
    
    var mkCircle = function(x, y, r, obj) {
        var c = C.circle(x, y, r).attr({
            'stroke-width': 4,
            'stroke': '#FF6600',
        });

        c.obj = obj;

        c.followers = [];
       
        if (obj.icon) {
            var img = C.image(obj.icon,x-r,y-r,r*2,r*2);
            c.followers.push(img);
            c.attr('fill', 'rgba(255,255,255,0.1)');
        } else {
            c.attr('fill', '#fff');
        }

        c.onAnimation(move);

        c.mouseover(loadTooltip)
        c.mouseout(function() {
            tooltip.fadeOut(100);
            lastOver = null;
        })

        c.toFront();
        
        return c;
    }

    var hideAll = function(t, cb1, cb2) {
        join.hide();
        leave.hide();
        for (var i=connections.length; i--;) {
            connections[i].line.animate({opacity:0.0},t);
        }
        for (var i=usrgrps.length; i--;) {
            for(var j=usrgrps[i].followers.length; j--;) {
                usrgrps[i].followers[j].block = true;
                usrgrps[i].followers[j].animate({opacity:0.0},t);
            }
            usrgrps[i].block = true;
            usrgrps[i].animate({opacity:0.0},t);
        }
        if(cb1) setTimeout(cb1, t+100);
        if(cb2) setTimeout(cb2, t+110);
    };

    var removeAll = function() {
        for (var i=connections.length; i--;) {
            connections[i].line.remove();
        }
        for (var i=usrgrps.length; i--;) {
            for(var j=usrgrps[i].followers.length; j--;) {
                usrgrps[i].followers[j].remove();
            }
            usrgrps[i].remove();
        }
        connections = [];
        usrgrps = [];
    };

    var removeOthers = function(e) {
        this.isContext = true;
        this.stop();
        context = this;
        var o = this;
        for (var i = connections.length; i--;) {
            connections[i].line.remove();
        }
        for (var i=0; i<this.followers.length; i++) {
            this.followers[i].toFront();
        } 
        this.toFront();
        for (var i=0; i<usrgrps.length; i++) {
            if (usrgrps[i]!==this) {
                usrgrps[i].block = true;
                usrgrps[i].animate({ cx: w/2, cy:h/2, r:h3 }, 1000, "backIn");
            } else {
                this.block = true;
                this.animate({ cx: w/2, cy:h/2, r:h1 }, 1100, "backIn", function() {
                    for (k=0; k<usrgrps.length; k++) {
                        if (usrgrps[k] !== o) {
                            for (var j=0; j<usrgrps[k].followers.length; j++) {
                                usrgrps[k].followers[j].remove();
                            } 
                            usrgrps[k].remove();
                        }
                    }
                    connections = [];
                    usrgrps = [];
                    if (o.obj['isgroup']) {
                        showMembers(o);
                    } else {
                        makeUser(parseInt(o.obj['id']));
                        for (var j=0; j<o.followers.length; j++) {
                            o.followers[j].remove();
                        } 
                        o.remove();
                    }
                });
            }
        }
    };
    
    var makeUser = function(id) {
        console.log(userid);
        console.log(id);
        leave.hide();
        apiGet("/api/user/"+id, function(data) {
            var newUser = mkCircle(w/2, h/2, h1, data["user"]);
            newUser.isTarget = true;
            usrgrps.push(newUser);
            showGroups(newUser);
            if (id===userid)
                showOtherGroups(newUser);
            context =newUser;
        });
    };

    var showMembers = function(group) {
        if (group.notMemberOf) {
            join.show();
        } else {
            leave.show();
        }
        usrgrps.push(group);
        apiGet("/api/group/"+group.obj.id+"/member", function(data) {
            var n = data["users"].length;
            var rad = (Math.PI*2)/n;
            var ux = group.attr('cx');
            var uy = group.attr('cy');
            $.each(data["users"], function(k, o) {
                var m = mkCircle(ux, uy, h2, o)
                .attr({'stroke':'#F5C700'})
                .animate({
                    cx: ux+Math.sin(rad*k)*hRad,
                    cy: uy+Math.cos(rad*k)*hRad
                }, 1000, "backOut", function() {
                    this.block=false;
                });
                m.mouseup(removeOthers);
                m.block = true;
                usrgrps.push(m);
                m.isTarget = true;
                connections.push(C.connection(group, m, "#000"));
            });
        });
    };

    var showGroups = function(user) {
        apiGet("/api/user/"+user.obj.id+"/groups", function(data) {
            var n = data["groups"].length;
            var rad = (Math.PI*2)/n;
            var ux = user.attr('cx');
            var uy = user.attr('cy');
            $.each(data["groups"], function(k, o) {
                var g = mkCircle(ux, uy, h2, o)
                .attr({'stroke':'#6A961F'})
                .animate({
                    cx: ux+Math.sin(rad*k)*hRad,
                    cy: uy+Math.cos(rad*k)*hRad
                }, 1000, "backOut", function() {
                    this.block = false;
                });
                g.block = true;
                usrgrps.push(g);
                connections.push(C.connection(user, g, "#000"));
                g.isTarget = true;
                g.notMemberOf = false;
                g.mousedown(removeOthers);
            });
            user.toFront();
        });
    }

    var rE = function() {
        return Math.random();
        //return 1-Math.pow(Math.random(),3);
    }
    
    var getNiceRandom = function() {
        return [
            h1+rE()*(w-(h1*2)),
            (h1+h2)+rE()*(h-(h1*2+h2))
        ];
    }

    var moveRandom = function(el) {
        el.toBack();
        el.radomMoved = true;
        var p = getNiceRandom();
        var diff = Math.sqrt(
                    Math.pow(p[0]-parseInt(el.attr('cx')),2)+
                    Math.pow(p[1]-parseInt(el.attr('cy')),2));
        el.animate({
            cx: p[0],
            cy: p[1]   
        }, diff*100, function() {
            setTimeout(function(){
              moveRandom(el);  
            }, 1000);
        });
    }

    var showOtherGroups = function(user) {
        apiGet("/api/user/"+user.obj.id+"/groups/notmemberof", function(data) {
            $.each(data["groups"], function(k, o) {
                var nextPos = getNiceRandom();
                var g = mkCircle(nextPos[0], nextPos[1], h2, o)
                .attr({'stroke':'#000'})
                .mouseout(function() {
                    tooltip.fadeOut(100);
                    lastOver = null;
                    if (!this.isContext) {
                        this.stop();
                        moveRandom(g);
                    }
                });
                this.isContext = false;
                usrgrps.push(g);
                g.isTarget = true;
                g.notMemberOf = true;
                g.mousedown(removeOthers);
                moveRandom(g);
                g.toBack();
                if (g.followers.length)
                    g.followers[0].toBack();
            });
            user.toFront();
        });
    }

    var loadTooltip = function() {
        console.log(this);
        if (!this.block && !this.isContext)
            this.stop();
        if (this.isTarget)
            lastOver = this.obj;
        tooltip.find('h4').html(this.obj.name);
        var content = this.obj.msg;
        if (this.obj.id===userid) content = "This is You";
        tooltip.find('p').html(content);
        tooltip.fadeIn(200);
        tooltip.current = this;
    }

    var center = w/2;
    var makeHedon = function() {
        hedon = mkCircle(center-(h4+5)*3, h4+5,h4,
            {name:"Hedon", id:"Hedon", icon:"/hedon.png",
             msg:"Give hedons to somebody that you think has deserved a treat "+
                 "for achieving something that was hard for him." })
        .drag(move, start, restoreUp(makeHedon))
        .mouseover(loadTooltip)
        .mouseout(function() {
            tooltip.fadeOut(100);
        })
        .attr({
            'fill':"#fff",
            'stroke':"#dd0000",
            opacity:1.0
        });
    };

    var makeDolor = function() {
        dolor = mkCircle(center-(h4+5),h4+5,h4,
            {name:"Dolor", id:"Dolor", icon:"/dolor.png",
             msg:"Give dolors to sombody as a sign that you think he "+
                 "could have done something better" })
        .drag(move, start, restoreUp(makeDolor))
        .mouseover(loadTooltip)
        .mouseout(function() {
            tooltip.fadeOut(100);
        })
        .attr({
            'fill':"#fff",
            'stroke':"#5A3956",
            opacity:1.0
        });
    };
    var makeCollecton = function() {
        collecton = mkCircle(center+(h4+5),h4+5,h4,
            {name:"Collecton", id:"Collecton", icon:"/collecton.png",
             msg:"Give collectons when someone behaved "+
                 "socially positive" })
        .drag(move, start, restoreUp(makeCollecton))
        .mouseover(loadTooltip)
        .mouseout(function() {
            tooltip.fadeOut(100);
        })
        .attr({
            'fill':"#fff",
            'stroke':"#dd0000",
            opacity:1.0
        });
    };
    var makeAntiCollecton = function() {
        antiCollecton = mkCircle(center+(h4+5)*3,h4+5,h4,
            {name:"Anti-Collecton", id:"Anti-Collecton", icon:"/anticollecton.png",
             msg:"Give anti-collectons to people or groups that "+
                 "you think could behave more social." })
        .drag(move, start, restoreUp(makeAntiCollecton))
        .mouseover(loadTooltip)
        .mouseout(function() {
            tooltip.fadeOut(100);
        })
        .attr({
            'fill':"#fff",
            'stroke':"#5A3956",
            opacity:1.0
        })
    };
    makeHedon();
    makeDolor();
    makeCollecton();
    makeAntiCollecton();

    var back = mkButton(10,h/2-100,"#EFE10C","/back.png","Go back", function() {
        hideAll(1000, removeAll, function() {
            makeUser(userid);
        });
    });
    
    var join = mkButton(10,h/2+80,"#1C8D0F","/join.png",
        "Join currently focused group", function() {
        var txt = "Joining Group "+context.obj.name+", write something nice: ";
        var msg = prompt(txt);
        if (msg) {
            joinGroup(context.obj.id, msg, function(data) {
                hideAll(1000, removeAll, function() {
                    makeUser(userid);
                });
            });
        }
    });

    var leave = mkButton(10,h/2+80, "#CC1950","/leave.png",
        "Leave currently focused group",function() {
        var txt = "Leaving group "+context.obj.name+", sure?";
        var msg = confirm(txt);
        if (msg) {
            leaveGroup(context.obj.id, function(data) {
                hideAll(1000, removeAll, function() {
                    makeUser(userid);
                });
            });
        }
    });

    var profile = mkButton(10,h/2-40, "#3377ff","/profile.png",
        "See profile of focused user/group",function() {
        window.open('/usrgrp/'+context.obj.id);
    });

    var create = mkButton(10,h/2+20,"orange","/join.png",
        "Create a new group", function() {
        var txt = "Enter group name: ";
        var name = prompt(txt);
        if (name) { 
            txt = "Write a description: ";
            var msg = prompt(txt);
            if (msg) {
                createGroup(name, msg, function(data) {
                    hideAll(1000, removeAll, function() {
                        makeUser(userid);
                    });
                });
            }
        }
    });
    join.hide();
    leave.hide();

    makeUser(userid);
}

$(document).ready(function() {
    tooltip = $('#tooltip');
    $(document).mousemove(function(e) {
        tooltip.css({
            'left':e.pageX-parseInt(tooltip.css('width'))/2,
            'top':e.pageY+20
        }); 
    });
    tooltip.hide();
});
