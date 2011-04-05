apiGet = function(url, cb) {
    $.get(url).success(cb);
};

refreshLeaveList = function() {
    if (!userid) return;
    $.get("/api/user/"+userid+"/groups")
    .success(function(data) {
        var newList = "";
        if (newList.length>0)  {
            $("#leavelist").html(newList);
            $("#dropgroup").html(newList);
            $('#dropgroup').change();
        }
    });
}

        
sendReward = function(to, type, msg, amount, success) {
    var postData = {
        usrgrpid: to,
        type: type,
        reason: msg,
        amount: amount 
    };

    request = $.post("/sendreward", postData)
        .success(success) 
        .error(console.log);
}

joinGroup = function(gid, msg, success) {
    var postData = {
        usrgrpid: gid,
        msg: msg,
    };

    request = $.post("/joingroup", postData)
        .success(success) 
        .error(console.log);
}

createGroup = function(gid, msg, success) {
    var postData = {
        group: gid,
        msg: msg,
        join: true,
    };

    request = $.post("/creategroup", postData)
        .success(success) 
        .error(console.log);
}

leaveGroup = function(gid, success) {
    var postData = {
        usrgrpid: gid,
    };

    request = $.post("/leavegroup", postData)
        .success(success) 
        .error(console.log);
}

refreshRewardList = function() {
    if (!userid) return;
    $.get("/api/rewards")
        .success(function(data) {
            var newList = "";
            $.each(data["rewards"], function(key, object) {
                var rid = object["id"];
                var sender = "<b>"+object["fName"]+"</b>";
                var receiver = "<b>"+object["tName"]+"</b>";
                if (sender==receiver) receiver = "him/herself"
                newList += "<div class='reward' id='r"+rid+"'>"+
                    sender+" sent a "+object["type"]+" to "+receiver+
                    ", Reason: "+object["reason"]+"</div>";
            });
            if (newList.length>0)  {
                $("#dashboard").html(newList);
            }
        });
}
refreshRewardList();
