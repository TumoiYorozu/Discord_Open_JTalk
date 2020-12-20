
## Install

```
sudo apt update
sudo apt install -y nodejs npm open-jtalk
sudo npm install n -g
sudo n 12.16.2 
sudo apt purge -y nodejs npm
exec $SHELL -l


git clone --recursive https://github.com/TumoiYorozu/Discord_Open_JTalk
cd Discord_Open_JTalk
mkdir tmp_wav dic

wget "https://ja.osdn.net/frs/g_redir.php?m=jaist&f=mmdagent%2FMMDAgent_Example%2FMMDAgent_Example-1.8%2FMMDAgent_Example-1.8.zip" -O MMDAgent_Example-1.8.zip
unzip MMDAgent_Example-1.8.zip
rm MMDAgent_Example-1.8.zip

wget "https://ja.osdn.net/frs/g_redir.php?m=jaist&f=open-jtalk%2FDictionary%2Fopen_jtalk_dic-1.11%2Fopen_jtalk_dic_utf_8-1.11.tar.gz" -O open_jtalk_dic_utf_8-1.11.tar.gz
tar xvzf open_jtalk_dic_utf_8-1.11.tar.gz -C dic
rm open_jtalk_dic_utf_8-1.11.tar.gz

npm install
npx tsc
```

Edit `config.json`

## Run

```
node ./build/index.js
```
