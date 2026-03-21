import urllib.request

urls = {
    'assets/cozy_bgm.mp3': 'https://cdn.pixabay.com/audio/2022/01/18/audio_6108ad4197.mp3',
    'bearded-dragon-racer/assets/racer_bgm.mp3': 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8de304250.mp3'
}

for path, url in urls.items():
    print(f"Downloading {path}...")
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://pixabay.com/'
    })
    try:
        with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
            out_file.write(response.read())
        print(f"Success: {path}")
    except Exception as e:
        print(f"Failed to download {path}: {e}")
