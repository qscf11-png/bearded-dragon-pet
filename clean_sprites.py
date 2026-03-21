from PIL import Image
import os

def defringe_image(path):
    print(f"Processing {path}...")
    if not os.path.exists(path):
        print("File not found.")
        return
        
    img = Image.open(path).convert("RGBA")
    data = img.getdata()
    new_data = []
    
    pixels_modified = 0
    
    for r, g, b, a in data:
        # 移除半透明的抗鋸齒像素 (毛邊主要來源)
        if 0 < a < 200:
            new_data.append((0, 0, 0, 0)) # 變為全透明
            pixels_modified += 1
        # 對於接近白色的邊緣亮點也強制去除
        elif a == 255 and r > 230 and g > 230 and b > 230:
            new_data.append((0, 0, 0, 0))
            pixels_modified += 1
        else:
            new_data.append((r, g, b, a))
            
    img.putdata(new_data)
    img.save(path)
    print(f"Done. Modified {pixels_modified} edge pixels.")

defringe_image('assets/pet_variants.png')
defringe_image('bearded-dragon-racer/assets/car.png')
