import os
import base64
import requests
import json
from flask import Flask, render_template, request, jsonify
import time # <<< TAMBAHKAN BARIS INI

app = Flask(__name__)

# Direktori untuk menyimpan file sementara
UPLOAD_FOLDER = 'temp_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# PENTING: Ganti dengan API Key Plant.id Anda yang sebenarnya!
PLANT_ID_API_KEY = "J3EgkJ401vT1cWPDOjn9aqkdzOMgQXYdCKhIt9fHNXqS4ApEqT"

@app.route('/')
def index():
    """Melayani halaman HTML utama."""
    return render_template('index.html')

@app.route('/identify', methods=['POST'])
def identify_plant():
    """Endpoint untuk menerima gambar dan mengidentifikasi tanaman."""
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"error": "No image data provided"}), 400

    image_data_b64 = data['image']
    # Hapus prefix "data:image/jpeg;base64," jika ada
    if "base64," in image_data_b64:
        image_data_b64 = image_data_b64.split(',')[1]

    # Simpan gambar sementara
    # Perbaikan: time.time() sekarang bisa digunakan karena 'time' sudah diimport
    image_filename = os.path.join(UPLOAD_FOLDER, f"plant_image_{int(time.time())}.jpg")
    try:
        with open(image_filename, "wb") as fh:
            fh.write(base64.b64decode(image_data_b64))
    except Exception as e:
        # Menambahkan print debug untuk error ini
        print(f"DEBUG: Error decoding or saving image: {e}")
        return jsonify({"error": f"Failed to decode or save image: {e}"}), 500

    headers = {
        'Api-Key': PLANT_ID_API_KEY,
    }
    payload = {
        'organs': ['leaf', 'flower', 'fruit', 'bark', 'stem'],
    }
    
    files = None
    try:
        # Pastikan API Key sudah diganti, jika tidak akan ada error 401
        if PLANT_ID_API_KEY == "YOUR_PLANT_ID_API_KEY_HERE":
            raise ValueError("PLANT_ID_API_KEY belum dikonfigurasi!")

        files = {'images': open(image_filename, 'rb')}
        response_plant_id = requests.post('https://api.plant.id/v2/identify', headers=headers, data=payload, files=files)
        response_plant_id.raise_for_status() # Akan memunculkan HTTPError untuk status kode 4xx/5xx
        result_plant_id = response_plant_id.json()

        # Proses hasil dari Plant.id API
        if result_plant_id and result_plant_id['suggestions']:
            best_match_scientific = result_plant_id['suggestions'][0]['plant_name']
            probability = result_plant_id['suggestions'][0]['probability'] * 100

            common_name = None
            if 'common_names' in result_plant_id['suggestions'][0] and \
               result_plant_id['suggestions'][0]['common_names']:
                common_name = result_plant_id['suggestions'][0]['common_names'][0]

            response_data = {
                "success": True,
                "common_name": common_name,
                "scientific_name": best_match_scientific,
                "probability": f"{probability:.2f}"
            }
        else:
            response_data = {
                "success": False,
                "message": "Maaf, saya tidak bisa mengidentifikasi tanaman ini."
            }

    except ValueError as e: # Tangkap error jika API Key belum diset
        response_data = {"success": False, "message": str(e)}
        print(f"DEBUG Error: {e}")
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        error_msg = f"Terjadi kesalahan HTTP dari Plant.id API: {status_code}"
        if status_code == 401:
            error_msg += ". Periksa kembali API Key Plant.id Anda."
        response_data = {"success": False, "message": error_msg}
        print(f"DEBUG HTTP Error: {e.response.text}")
    except requests.exceptions.ConnectionError:
        response_data = {"success": False, "message": "Gagal terhubung ke Plant.id API. Periksa koneksi internet server."}
    except Exception as e:
        response_data = {"success": False, "message": f"Terjadi kesalahan internal server: {e}"} # Lebih spesifik
        print(f"DEBUG Server Error: {e}")
    finally:
        if files and 'images' in files:
            files['images'].close()
        if os.path.exists(image_filename):
            os.remove(image_filename) # Hapus file sementara setelah diproses

    return jsonify(response_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)