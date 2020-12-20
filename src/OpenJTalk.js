var exec = require('child_process').exec
  , path = require('path')
  , uuid = require('uuid-v4')
  , fs   = require('fs')
;

// デフォルトパラメタ

// OpenJTalk で wav ファイルを生成するクラス
var OpenJTalk = function(config, setting) {
	var config  = config || {};
	var setting = setting || {};
	var options = config;
	for (var key in setting) {
		options[key] = setting[key];
	}
	for (var key in options) {
		this[key] = options[key];
	}
};


OpenJTalk.prototype = {
	// exec から open_jtalk を実行して wav ファイルを作る
	makeWav : function (str, callback) {
		const id = uuid();
		var wavFileName = id + '.wav';
		var txtFileName = id + '.txt';
		
		const ot = path.join(this.wav_dir, txtFileName);

		var ojtCmd = this.openjtalk_bin;
		var options = {
			m  : this.voice_dir + this.voice_list[this.voice] + '.htsvoice',
			x  : this.dic_dir,
			s  : this.sampling_rate,
			p  : this.pitch,
			g  : this.g,
			a  : this.a,	// [0,1] オールパス値
			b  : this.b,	// [0,1] ポストフィルター係数
			u  : this.u,	// [0,1] 有声/無声境界値
			jm : this.jm,	// [0,]  スペクトラム系列内変動の重み
			jf : this.jf,	// [0,]  F0系列内変動の重み
			r  : this.r,    //  -r （[0,]スピーチ速度係数）
			fm : this.fm,   //  -fm （追加ハーフトーン）
			z  : this.audio_buff_size,
			ow : path.join(this.wav_dir, wavFileName),
		};
		for (var option in options) {
			var value = options[option];
			if (value) {
				ojtCmd += ' -' + option + ' ' + value;
			}
		}

		// console.log(ot, str)
		fs.writeFileSync(ot, str);

		// var cmd = 'echo "' + str + '" | ' + ojtCmd;
		var cmd = ojtCmd + " " + ot;
		// console.log(cmd)
		exec(cmd, function(err, stdout, stderr) {
			var result = {
				stdout   : stdout,
				stderr   : stderr,
				wav      : options.ow,
				txt_path : ot
			};
			if (callback) callback(err, result);
		});
	}
};

module.exports = OpenJTalk;