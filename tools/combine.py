import sys
from PIL import Image
out_path = sys.argv[1]
scale = float(sys.argv[2])
files = sys.argv[3:]
ims = [Image.open(f) for f in files]
w = max(i.size[0] for i in ims); h = sum(i.size[1] for i in ims)
out = Image.new('RGB', (w, h))
y = 0
for im in ims:
    out.paste(im, (0, y)); y += im.size[1]
out = out.resize((int(w*scale), int(h*scale)))
out.save(out_path)
