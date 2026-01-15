from rembg import remove
from PIL import Image
import os

input_path = 'static/favicon-1.png'
output_path = 'static/favicon.png'

# Check if input exists
if not os.path.exists(input_path):
    print(f"Error: {input_path} not found.")
    exit(1)

print(f"Processing {input_path}...")
input_image = Image.open(input_path)
output_image = remove(input_image)
output_image.save(output_path)
print(f"Saved to {output_path}")
