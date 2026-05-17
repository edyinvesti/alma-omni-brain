import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import os

class AlmaVision:
    def __init__(self):
        # Configuração do novo Hand Landmarker (API de Tasks)
        model_path = os.path.join(os.path.dirname(__file__), 'hand_landmarker.task')
        
        # Se o modelo não existir localmente no detector.py, tenta o caminho relativo
        if not os.path.exists(model_path):
            # Fallback para o caminho do projeto se necessário
            model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "hand_landmarker.task"))

        if not os.path.exists(model_path):
            self.landmarker = None
            print(f"[AVISO VISÃO] Modelo não encontrado em {model_path}. Detecção desativada.")
            return

        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=2,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.landmarker = vision.HandLandmarker.create_from_options(options)
        self.cap = None

    def start_camera(self):
        self.cap = cv2.VideoCapture(0)
        print("[SISTEMA] Câmera ativada. Escaneando ambiente...")

    def detect_gestures(self):
        if not self.cap or not self.landmarker:
            return None
            
        success, img = self.cap.read()
        if not success:
            return None
            
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        
        detection_result = self.landmarker.detect(mp_image)
        
        if detection_result.hand_landmarks:
            for hand_landmarks in detection_result.hand_landmarks:
                # Desenho básico
                for lm in hand_landmarks:
                    h, w, c = img.shape
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(img, (cx, cy), 3, (0, 255, 0), -1)
                
        cv2.imshow("ALMA Vision - Detecção de Gestos", img)
        return detection_result

    def stop_camera(self):
        if self.cap:
            self.cap.release()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    v = AlmaVision()
    v.start_camera()
    try:
        while True:
            v.detect_gestures()
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        v.stop_camera()
