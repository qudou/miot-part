import sys, json, hashlib
from NEMbox import api
# simple JSON echo script

def login(account, password):
    local_account = account
    local_password = hashlib.md5(password.encode('utf-8')).hexdigest()
    login_info = ne.login(local_account, local_password)
    return login_info

ne = api.NetEase()
for line in sys.stdin:
  result = {}
  args = json.loads(line)
  if args[0] == "top_songlist":
    result = ne.top_songlist(args[1])
  elif args[0] == "songs_detail_new_api":
    result = ne.songs_detail_new_api([args[1]])[0]
  elif args[0] == "login":
    result = login(args[1], args[2])
  elif args[0] == "personal_fm":
    result = ne.personal_fm()
  elif args[0] == "get_version":
    result = ne.get_version()
  elif args[0] == "daily_signin":
    result = ne.daily_signin(args[1])
  elif args[0] == "recommend_playlist":
    result = ne.recommend_playlist(args[1])
  elif args[0] == "user_playlist":
    result = ne.user_playlist(args[1])
  elif args[0] == "playlist_detail":
    result = ne.playlist_detail(args[1])
  elif args[0] == "songs_detail":
    result = ne.songs_detail(args[1])
  elif args[0] == "channel_detail":
    result = ne.channel_detail(args[1])
  print json.dumps(result)