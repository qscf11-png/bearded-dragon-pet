import urllib.request
import os

url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3"
out_path = os.path.join("assets", "cozy_bgm.mp3")

print(f"Downloading from {url}...")
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(out_path, 'wb') as out_file:
        out_file.write(response.read())
    print(f"Download complete: {out_path}")
except Exception as e:
    print(f"Error downloading: {e}")
