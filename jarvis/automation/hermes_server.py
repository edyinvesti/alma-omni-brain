from flask import Flask, request, jsonify
from pc_controller import HermesAgent
import traceback
import subprocess

app = Flask(__name__)
hermes = HermesAgent()

@app.route('/api/hermes/exec', methods=['POST'])
def exec_command():
    """Executa um comando shell generico vindo da nuvem (pesquisa, abrir apps, etc.)"""
    try:
        data = request.json or {}
        command = data.get('command', '').strip()
        if not command:
            return jsonify({"status": "error", "message": "Nenhum comando fornecido"}), 400
        print(f"[HERMES EXEC] Executando: {command}")
        subprocess.Popen(command, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return jsonify({"status": "success", "message": f"Comando executado: {command}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/work_mode', methods=['POST'])
def work_mode():
    try:
        hermes.work_mode()
        return jsonify({"status": "success", "message": "Work mode activated"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/clean_system', methods=['POST'])
def clean_system():
    try:
        hermes.clean_temp()
        return jsonify({"status": "success", "message": "System cleaned"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

@app.route('/api/hermes/open_path', methods=['POST'])
def open_path():
    try:
        data = request.json
        path = data.get('path', '')
        success = hermes.open_path(path)
        if success:
            return jsonify({"status": "success", "message": f"Opened {path}"})
        else:
            return jsonify({"status": "error", "message": f"Could not find or open {path}"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trace": traceback.format_exc()}), 500

if __name__ == '__main__':
    print("|| HERMES DAEMON INICIADO (PORTA 3001) ||")
    app.run(host='0.0.0.0', port=3001, threaded=True)
