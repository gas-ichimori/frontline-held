"""
スプライト画像サイズ統一スクリプト
実行: python3 resize_sprites.py

対象ディレクトリ内の .png を指定キャンバスサイズに統一。
・透明ピクセルを無視して被写体の bbox を検出
・被写体を等倍で最大化してキャンバス中央に配置
・背景は透明 (RGBA)

設定:
  ENEMY_SIZE  = 敵スプライトのキャンバスサイズ (正方形 px)
  PLAYER_SIZE = プレイヤースプライトのキャンバスサイズ (幅px, 高さpx)
  DRY_RUN     = True なら変更せず結果だけ表示
"""

from PIL import Image
import os
import shutil

# ── 設定 ──────────────────────────────────────────────
IMAGES_DIR  = os.path.join(os.path.dirname(__file__), 'assets', 'images')
ENEMY_SIZE  = (512, 512)    # 敵スプライト統一サイズ（正方形）
PLAYER_SIZE = (300, 480)    # プレイヤースプライト統一サイズ
PADDING     = 0.05          # 被写体の周囲に入れる余白（キャンバス比）
DRY_RUN     = False         # True: ファイルを変更しない（確認用）
# ──────────────────────────────────────────────────────

def normalize(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """被写体を中央に配置した target_w × target_h の RGBA 画像を返す"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # 透明ピクセルを除いた bbox を取得
    bbox = img.getbbox()
    if bbox is None:
        # 全透明なら空キャンバスを返す
        return Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))

    cropped = img.crop(bbox)
    cw, ch  = cropped.size

    # 余白を考慮した最大表示サイズ
    pad_px_w = int(target_w * PADDING)
    pad_px_h = int(target_h * PADDING)
    max_w    = target_w - pad_px_w * 2
    max_h    = target_h - pad_px_h * 2

    # アスペクト比を保ちながらリサイズ
    scale = min(max_w / cw, max_h / ch)
    new_w = max(1, int(cw * scale))
    new_h = max(1, int(ch * scale))
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    # 中央に配置
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    paste_x = (target_w  - new_w) // 2
    paste_y = (target_h - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def process_file(path: str, tw: int, th: int):
    img = Image.open(path)
    orig_size = img.size
    if orig_size == (tw, th):
        print(f'  SKIP  {os.path.relpath(path, IMAGES_DIR)}  ({orig_size[0]}×{orig_size[1]} — 既に正規サイズ)')
        return

    result = normalize(img, tw, th)

    if DRY_RUN:
        print(f'  DRY   {os.path.relpath(path, IMAGES_DIR)}  {orig_size[0]}×{orig_size[1]} → {tw}×{th}')
    else:
        # バックアップ
        bak = path + '.bak'
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
        result.save(path, 'PNG')
        print(f'  DONE  {os.path.relpath(path, IMAGES_DIR)}  {orig_size[0]}×{orig_size[1]} → {tw}×{th}')


def main():
    print(f'{"[DRY RUN] " if DRY_RUN else ""}スプライト正規化 開始')
    print(f'  敵スプライト: {ENEMY_SIZE[0]}×{ENEMY_SIZE[1]}')
    print(f'  プレイヤー:   {PLAYER_SIZE[0]}×{PLAYER_SIZE[1]}')
    print()

    for root, dirs, files in os.walk(IMAGES_DIR):
        dirs.sort()
        for fname in sorted(files):
            if not fname.endswith('.png'):
                continue
            path = os.path.join(root, fname)
            rel  = os.path.relpath(root, IMAGES_DIR)

            if fname == 'bg.png':
                print(f'  SKIP  {fname}  (背景画像 — 対象外)')
                continue

            if rel.startswith('player'):
                process_file(path, PLAYER_SIZE[0], PLAYER_SIZE[1])
            else:
                process_file(path, ENEMY_SIZE[0], ENEMY_SIZE[1])

    print()
    print('完了。元画像は .bak として保存されています。')


if __name__ == '__main__':
    main()
