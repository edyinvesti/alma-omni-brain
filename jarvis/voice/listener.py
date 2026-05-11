import speech_recognition as sr

class JarvisListener:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        try:
            self.microphone = sr.Microphone()
            self.has_mic = True
        except (AttributeError, ImportError, Exception) as e:
            print(f"[AVISO] Microfone indisponível (PyAudio ausente): {e}")
            self.has_mic = False
        self.recognizer.dynamic_energy_threshold = True

    def listen(self):
        if not self.has_mic:
            # Fallback: could use sounddevice here or just wait for input via other means
            # For now, we'll just return empty or wait a bit
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
    l = JarvisListener()
    cmd = l.listen()
    print(f"Comando capturado: {cmd}")
