from PIL import Image, ImageFilter
import os

def advanced_remove_bg(path, is_pet=False):
    print(f"Processing {path}...")
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
        
    img = Image.open(path).convert("RGBA")
    data = img.getdata()
    width, height = img.size
    
    # 第一階段：嚴格閾值去背
    new_data = []
    for r, g, b, a in data:
        # 如果是寵物，之前已經做過透明度處理，我們針對殘留的實色邊緣（非皮膚色的灰白）
        if is_pet:
            # 鬃獅蜥是橘色系，如果有極高明度的灰白像素(邊緣反光或鋸齒)，視為背景
            # 容忍橘色 (R高，GB低)
            if a > 0:
                # 判斷是否為接近白色的灰階
                if r > 180 and g > 180 and b > 180 and abs(r-g) < 30 and abs(g-b) < 30:
                    new_data.append((0, 0, 0, 0)) # 去除亮白邊緣
                elif 0 < a < 255:
                    new_data.append((0, 0, 0, 0)) # 去除所有半透明
                else:
                    new_data.append((r, g, b, a))
            else:
                new_data.append((0, 0, 0, 0))
        else:
            # 對於裝飾物，原本是白底
            # 如果非常接近白色，就變成透明
            if r > 210 and g > 210 and b > 210:
                new_data.append((0, 0, 0, 0))
            elif a < 255:
                # 去除原本的半透明抗鋸齒
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append((r, g, b, 255))
    
    img.putdata(new_data)
    
    # 針對裝飾物進行邊界腐蝕 (Erosion) 以消除白邊
    if not is_pet:
        alpha = img.split()[3]
        # 用 MinFilter(3) 對 Alpha 頻道進行腐蝕 (削去 1 像素的外邊緣)
        eroded_alpha = alpha.filter(ImageFilter.MinFilter(3))
        img.putalpha(eroded_alpha)
        
    # 如果是寵物，也做一次輕微的銳化和邊緣修整
    if is_pet:
        alpha = img.split()[3]
        # 把 Alpha 小於 255 的變成 0
        solid_alpha = alpha.point(lambda p: 255 if p > 200 else 0)
        img.putalpha(solid_alpha)

    img.save(path)
    print(f"Done processing {path}.")

# 處理寵物
advanced_remove_bg('assets/pet_variants.png', is_pet=True)

# 處理裝飾物
decor_paths = [
    'bearded-dragon-terrarium/assets/rock.png',
    'bearded-dragon-terrarium/assets/log.png',
    'bearded-dragon-terrarium/assets/cactus.png',
    'bearded-dragon-terrarium/assets/plant_clay.png',
    'bearded-dragon-terrarium/assets/hideout_clay.png',
    'assets/owner.png'
]

for p in decor_paths:
    advanced_remove_bg(p, is_pet=False)
