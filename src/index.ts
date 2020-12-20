
declare function require(x: string): any;
import * as Discord from "discord.js";
const OpenJTalk = require('../src/OpenJTalk');
const fs        = require('fs');
const JSON5     = require('json5');
const emoji     = require('node-emoji');
const process   = require('process');


var configs_json = JSON.parse(fs.readFileSync('config.json', 'utf8'));
console.log("config\n", configs_json)
if(configs_json.token == null) {
    console.error("no token!");
    process.exit(-1);
}
if(configs_json.prefix == null) {
    console.error("no prefix!");
    process.exit(-1);
}

var VoiceConfig = {
	openjtalk_bin : 'open_jtalk',
	dic_dir       : './dic/open_jtalk_dic_utf_8-1.11',
    wav_dir       : './tmp_wav/',
    voice_dir     : './',
    voice_list : {
        mei         : 'MMDAgent_Example-1.8/Voice/mei/mei_normal',
        mei_angry   : 'MMDAgent_Example-1.8/Voice/mei/mei_angry',
        mei_bashful : 'MMDAgent_Example-1.8/Voice/mei/mei_bashful',
        mei_happy   : 'MMDAgent_Example-1.8/Voice/mei/mei_happy',
        mei_sad     : 'MMDAgent_Example-1.8/Voice/mei/mei_sad',
        takumi      : 'MMDAgent_Example-1.8/Voice/takumi/takumi_normal',
        takumi_angry: 'MMDAgent_Example-1.8/Voice/takumi/takumi_angry',
        takumi_sad  : 'MMDAgent_Example-1.8/Voice/takumi/takumi_sad',
        tohoku      : 'htsvoice-tohoku-f01/tohoku-f01-neutral',
        tohoku_angry: 'htsvoice-tohoku-f01/tohoku-f01-angry',
        tohoku_happy: 'htsvoice-tohoku-f01/tohoku-f01-happy',
        tohoku_sad  : 'htsvoice-tohoku-f01/tohoku-f01-sad',
    }
};

// http://moblog.absgexp.net/openjtalk/
const OpenJTalkOptions = [
	["g",  -99, 99],
	["a",    0, 1],
	["b",    0, 1],
	["u",    0, 1],
	["jm",   0, 99],
	["jf",   0, 99],
	["r",    0, 99],
	["fm", -99, 99]
];

const VoiceSettings = [
    'voice:"mei"'
]

const token = configs_json.token;
const prefix       = configs_json.prefix
const cmd_start    = "s"
const cmd_active   = "a"
const cmd_deactive = "d"
const cmd_break    = "b"
const cmd_list     = "l"
const cmd_quit     = "quit"
const cmd_change   = "c"


const voice_del_timer = 2*60*1000;

const client = new Discord.Client();

client.on('ready', () => {
    console.log('ready...');
});

class Room {
    voice_ch : Discord.VoiceChannel;
    conn     : Discord.VoiceConnection | null;
    text_ch  : Discord.TextChannel;
    users    : { [key: string]: typeof OpenJTalk; } = {};
    queue    : string[] = [];
    speaking : boolean = false;
    constructor(vch : Discord.VoiceChannel, conn : Discord.VoiceConnection, tch  : Discord.TextChannel) {
        this.voice_ch = vch;
        this.text_ch  = tch;
        this.conn     = conn;
    }
}
let rooms: { [key: string]: Room; } = {};



function parse_option(config : string) {
    config = "{" + config + "}";
    config = config.replace("=", ":");
    var obj;
    var res : { [key: string]: any; } = {};
    var res_message = "";
    try {
        obj = JSON5.parse(config);
    } catch (e) {
        obj = null;
    }
    if(obj == null) {
        res_message += "Invalid format.\n";
    } else {
        if(obj.voice != null) {
            if(obj.voice in VoiceConfig.voice_list) {
                res.voice = obj.voice;
            } else {
                res_message += "Voice " + obj.voice + " is not found.\n";
            }
        }
        for (const e of OpenJTalkOptions) {
            if(e[0] in obj) {
                const v = obj[e[0]];
                if(typeof v != 'number') {
                    res_message += "Option " + e[0] + " is not number. (type: "+ typeof v() +" val:" + v +")\n";
                    continue;
                }
                if(!(e[1] <= v && v <= e[2])) {
                    res_message += "Option " + e[0] + " is out of range. (range: [" + e[1]+", "+e[2] + "] val:" + v +")\n";
                    continue;
                }
                res[e[0]] = v;
            }
        }
    }
    return {res, res_message};
}
function get_settings(obj : typeof OpenJTalk) {
    var res : { [key: string]: any; } = {};
    if(obj.voice != null) {
        res.voice = obj.voice;
    }
    for (const e of OpenJTalkOptions) {
        if(e[0] in obj) {
            res[e[0]] = obj[e[0]];
        }
    }
    res = JSON5.stringify(res);
    return res.substr(1, res.length-2);
}

function update_talk_queue(gid : string) {
    if (rooms[gid] == null) return;
    if (rooms[gid].speaking) return;
    if (rooms[gid].queue.length == 0) return;
    const conn = rooms[gid].conn;
    if (conn == null) return;
    rooms[gid].speaking = true;
    
    const fname = rooms[gid].queue[0];
    rooms[gid].queue.shift();
    console.log("Start", fname);
    try {
        // console.log(rooms[gid].conn)
        const dispatcher = conn.play(fname);
        dispatcher.on('finish', () => {
            console.log("Finish!");
            fs.unlinkSync(fname);
            rooms[gid].speaking = false;
            update_talk_queue(gid);
            return;
        });
    } catch (error) {
        console.error(error);
        rooms[gid].speaking = false;
        update_talk_queue(gid);
        return;
    }
}


function check_talk(message : Discord.Message) {
    if(message.guild == null) return;
    const gid = message.guild.id;
    if (rooms[gid] == null) return;
    if (rooms[gid].text_ch.id != message.channel.id) return;
    const uid = message.author.id;
    if (rooms[gid].users[uid] == null) return;

    let str = message.content;
    str=str.replace(/(h?ttps?:\/\/)([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=~]*)?/g, ' URL省略 ');
    str=str.replace(/<(@!|#)[0-9]+>/g, ''); // ユーザー・チャンネル名削除
    str=str.replace(/(<:[^:]+:[0-9]+>|:[\w_]+:)/g, ' 絵文字 ');
    str=str.replace(/\n/g, " ");
    str=emoji.replace(str, () => " 絵文字 "); // 絵文字除去
    
    console.log("str: ", str);

    rooms[gid].users[uid].makeWav(str, (err : any, res : {stdout:string, stderr:string,wav:string,txt_path:string})=>{
        // console.log("stdout", res.stdout);
        // console.log("stderr", res.stderr);
        // console.log("wav", res.wav);
        try {
        fs.unlinkSync(res.txt_path);
        } catch (error) {
        }
        if(err != null) {
            console.error(err);
            rooms[gid].text_ch.send("Error : 音声生成エラー．非対応文字が含まれている可能性があります．\n");
            try {
                fs.unlinkSync(res.wav);
            } catch (error) {}
            return;
        }
        rooms[gid].queue.push(res.wav);
        setTimeout(()=>{
            try {
                fs.unlinkSync(res.wav);
            } catch (error) {}
        }, voice_del_timer);
        update_talk_queue(gid);
    })
};

async function speak_break(gid : string) {
    if (rooms[gid] == null) return;
    if (!rooms[gid].speaking) return;
    if (rooms[gid].conn == null) return;

    rooms[gid].queue = [];
    rooms[gid].speaking = false;
    rooms[gid].voice_ch.leave();
    setTimeout(async ()=>{
        rooms[gid].conn = await rooms[gid].voice_ch.join().catch((e)=>{
            console.log("Error");
            console.error(e);
            return null;
        });
        update_talk_queue(gid);
    }, 500);
}

function room_end(gid : string) {
    if (rooms[gid] == null) return;
    rooms[gid].voice_ch.leave();
    rooms[gid].text_ch.send("チャンネル <#" + rooms[gid].voice_ch.id + "> の読み上げを終了しました．");
    delete rooms[gid];
}

function get_help(){
    let res = "";
    res += "Commands\n"
    res += " `" + prefix + cmd_start    + "`: Start talk.\n";
    res += " `" + prefix + cmd_active   + "`: Activate user.\n";
    res += " `" + prefix + cmd_deactive + "`: Deactivate user.\n";
    res += " `" + prefix + cmd_break    + "`: Break speaking.\n";
    res += " `" + prefix + cmd_list     + "`: List active user.\n";
    res += " `" + prefix + cmd_change   + "`: Change settings.\n";
    res += " `" + prefix + cmd_quit     + "`: Quit talk.\n";
    res += "Settings\n"
    res += " `voice`:";
    for(const v in VoiceConfig.voice_list){
        res += " " + v + ",";
    }
    res += "\n"
    res += " parameters:";
    for(const i in OpenJTalkOptions){
        res += " " + OpenJTalkOptions[i][0]+",";
    }
    res += "\n see moblog.absgexp.net/openjtalk/"
    return res;
}

client.on('message', async message =>{
    if(message.author.bot) {
        return;
    }
    if (!message.content.startsWith(prefix)) {
        if(message.mentions.users.find(u => client.user != null && u.id == client.user.id)){
            message.channel.send(get_help());
        } else {
            check_talk(message);
        }
        return;
    }
    if(message.guild == null) return;
    
    if(message.channel.type !== "text") return;
    const gid = message.guild.id;
    console.log("gid", gid);

    if (message.content.startsWith(prefix+cmd_start)) {
        if (rooms[gid] != null) {
            message.channel.send("Error : このボットは既にこのギルドのチャンネル <#" + rooms[gid].text_ch.id + "> で使用されています．");
            return;
        }
        if(message.member == null) return;
        const vch = message.member.voice.channel;
        if(vch == null){
            message.channel.send("Error : ボイスチャンネルに参加してください．");
            return;
        }
        const conn = await vch.join().catch((e)=>{
            console.error(e);
            message.channel.send("Error : ボットがボイスチャンネルに参加するときにエラーが発生しました．");
            message.channel.send(e.message);
            return null;
        });
        if (conn == null) return;
        rooms[gid] = new Room(vch, conn, message.channel);
        message.channel.send("登録ユーザーがこのチャンネルで発言した内容を <#" + vch.id + "> で喋ります．");
        return;
    }
    if (rooms[gid] == null) {
        message.channel.send(get_help());
        return;
    }
    if (rooms[gid].text_ch.id != message.channel.id) {
        message.channel.send(get_help());
        return;
    }

    const uid = message.author.id;
    if (message.content.startsWith(prefix+cmd_active)) {
        if (rooms[gid].users[uid] != null) {
            message.channel.send("ユーザー <@!" + uid + "> は既にアクティブです．");
            // print setting
            return;
        }
        const VoiceSetting = parse_option(VoiceSettings[0]);
        // console.log(VoiceSetting);
        if(VoiceSetting.res_message != ""){
            console.error("System Setting Parse Error", VoiceSetting);
        }
        const setting_str = get_settings(VoiceSetting.res);

        rooms[gid].users[uid] = new OpenJTalk(VoiceConfig, VoiceSetting.res);
        message.channel.send("<@!" + uid + "> の代弁を開始しました．\nSettings: `" + setting_str + "`");
        return;
    }
    if (message.content.startsWith(prefix+cmd_deactive)) {
        if (rooms[gid].users[uid] == null) {
            message.channel.send("<@!" + uid + "> はアクティブではありません．");
            return;
        }
        delete rooms[gid].users[uid];
        message.channel.send("<@!" + uid + "> の代弁を終了しました．");
        return;
    }
    if (message.content.startsWith(prefix+cmd_list)) {
        let res = "";
        for(const uid in rooms[gid].users){
            res += "<@!" + uid + "> : `"  + get_settings(rooms[gid].users[uid]) + "`\n";
        }
        if (res == ""){
            res = "現在，読み上げが有効なユーザーはいません\n"
        }
        message.channel.send(res);
        return;
    }
    if (message.content.startsWith(prefix+cmd_change)) {
        if (rooms[gid].users[uid] == null) {
            message.channel.send("<@!" + uid + "> はアクティブではありません．");
            return;
        }
        const op = parse_option(message.content.substr((prefix+cmd_change).length));
		for (var p in op.res) {
            rooms[gid].users[uid][p] = op.res[p];
        }
        let res = op.res_message;
        if(Object.keys(op.res).length == 0) {
            res += "Warn : 設定は変更されませんでした．\n";
        }
        const setting_str = get_settings(rooms[gid].users[uid]);
        res += "Settings: `" + setting_str + "`"
        message.channel.send(res);
        return;
    }
    if (message.content.startsWith(prefix+cmd_break)) {
        await speak_break(gid);
        return;
    }
    if (message.content.startsWith(prefix+cmd_quit)) {
        await room_end(gid);
        return;
    }
    // unknown command
    message.channel.send(get_help());
});
client.login(token);
