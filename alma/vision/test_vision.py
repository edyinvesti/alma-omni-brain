import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import time
import os

class AlmaVision:
    def __init__(self):
        # Configuração do novo Hand Landmarker (API de Tasks)
        # Caminho absoluto para evitar erros de execução de diretórios diferentes
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(current_dir, 'hand_landmarker.task')
        
        if not os.path.exists(model_path):
            # Tenta um nível acima se estiver rodando de algum lugar estranho
            model_path = os.path.join(os.getcwd(), 'jarvis', 'vision', 'hand_landmarker.task')

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Modelo não encontrado. Verifique se 'hand_landmarker.task' está em {current_dir}")

        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=2,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.landmarker = vision.HandLandmarker.create_from_options(options)
        
        # Utilitários de desenho (ainda podem ser acessados via python se instalados, 
        # mas vamos simplificar se solutions estiver ausente)
        self.cap = None

    def start_camera(self):
        self.cap = cv2.VideoCapture(0)
        self.cap.set(3, 1280)
        self.cap.set(4, 720)
        print("[VISÃO] Câmera iniciada com nova API - Detecção de gestos ativada!")
        print("Pressione 'Q' para sair")

    def count_fingers(self, landmarks):
        fingers = []
        
        # No Hand Landmarker da nova API, landmarks são objetos com x, y, z
        # Thumb (polegar)
        if landmarks[4].x < landmarks[3].x:
            fingers.append(1)
        else:
            fingers.append(0)
            
        # 4 dedos
        for id in [8, 12, 16, 20]:
            if landmarks[id].y < landmarks[id - 2].y:
                fingers.append(1)
            else:
                fingers.append(0)
        
        return fingers

    def detect_gesture(self, landmarks):
        fingers = self.count_fingers(landmarks)
        total = fingers.count(1)
        
        if total == 0:
            return "Punho fechado"
        elif total == 5:
            return "Mão aberta"
        elif fingers == [0, 1, 1, 1, 1]:
            return "OK"
        elif fingers == [0, 1, 0, 0, 0]:
            return "Índice"
        elif fingers == [1, 1, 0, 0, 0]:
            return "Paz"
        else:
            return f"{total} dedos"

    def run(self):
        self.start_camera()
        
        print("\n" + "="*50)
        print("TESTE DE VISÃO (API TASKS) - ALMA VISION")
        print("="*50)

        try:
            while True:
                success, img = self.cap.read()
                if not success:
                    break
                
                img = cv2.flip(img, 1)
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
                
                # Executa detecção
                detection_result = self.landmarker.detect(mp_image)
                
                gesture_text = "Aguardando mão..."
                
                if detection_result.hand_landmarks:
                    for idx, hand_landmarks in enumerate(detection_result.hand_landmarks):
                        # Desenhar pontos manualmente (já que mp.solutions pode estar ausente)
                        for lm in hand_landmarks:
                            h, w, c = img.shape
                            cx, cy = int(lm.x * w), int(lm.y * h)
                            cv2.circle(img, (cx, cy), 5, (255, 0, 255), cv2.FILLED)
                        
                        gesture = self.detect_gesture(hand_landmarks)
                        gesture_text = f"Gesto: {gesture}"
                
                # Overlay
                cv2.rectangle(img, (10, 10), (400, 80), (0, 255, 0), -1)
                cv2.putText(img, gesture_text, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
                cv2.imshow("ALMA Vision (Nova API)", img)
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                    
        finally:
            self.stop_camera()

    def stop_camera(self):
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        print("\n[VISÃO] Câmera encerrada.")

if __name__ == "__main__":
    v = AlmaVision()
    v.run()