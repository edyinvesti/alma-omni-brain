import speech_recognition as sr
import sounddevice as sd
import numpy as np

class AlmaListener:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.has_mic = False
        self.microphone = None

        # Tentar pyaudio primeiro
        try:
            self.microphone = sr.Microphone()
            self.has_mic = True
            print("[VOZ] Microfone OK (PyAudio)")
        except:
            pass

        # Fallback para sounddevice
        if not self.has_mic:
            try:
                # Testa se há dispositivo de entrada
                devices = sd.query_devices(kind='input')
                if devices:
                    self.microphone = sr.Microphone()
                    self.has_mic = True
                    print(f"[VOZ] Microfone OK (sounddevice): {devices['name']}")
            except Exception as e:
                print(f"[AVISO] Microfone indisponível: {e}")

        self.recognizer.dynamic_energy_threshold = True

    def listen(self):
        if not self.has_mic:
            return ""

        with self.microphone as source:
            print("[SISTEMA] Aguardando comando de voz...")
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
            audio = self.recognizer.listen(source)
            
        try:
            print("[SISTEMA] Processando áudio...")
            text = self.recognizer.recognize_google(audio, language="pt-BR")
            print(f"[COMANDANTE] {text}")
            return text
        except sr.UnknownValueError:
            return ""
        except sr.RequestError as e:
            print(f"[ERRO] Falha no serviço de reconhecimento: {e}")
            return ""

if __name__ == "__main__":
    l = AlmaListener()
    cmd = l.listen()
    print(f"Comando capturado: {cmd}")
