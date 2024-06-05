async function uploadFile(event) {
  event.preventDefault();
  const form = document.getElementById('myForm');
  const formData = new FormData(form);

  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
  const registrationFormFile = formData.get('registrationForm');
  let photoFile = formData.get('photo');

  // Prüfen, ob die Gesamtgröße der Dateien 1 MB überschreitet
  const totalSize = registrationFormFile.size + photoFile.size;
  if (totalSize > 1048576) {
    alert("Die Gesamtgröße der Dateien darf nicht größer als 1 MB sein.");
    return;
  }

  // HEIC-Bilder in JPEG umwandeln
  if (photoFile.type === 'image/heic') {
    try {
      const convertedBlob = await heic2any({
        blob: photoFile,
        toType: 'image/jpeg',
      });
      photoFile = new File([convertedBlob], photoFile.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' });
    } catch (e) {
      alert("Fehler bei der Umwandlung von HEIC zu JPEG: " + e.message);
      return;
    }
  }

  // Verkleinern des Bildes
  const resizedPhoto = await resizeImage(photoFile, 425, 566, 1 * 1024 * 1024); // Maximal 1 MB

  const reader1 = new FileReader();
  reader1.readAsDataURL(registrationFormFile);

  reader1.onload = async function() {
    const registrationFormBase64 = reader1.result.split(',')[1];
    const resizedPhotoBase64 = resizedPhoto.split(',')[1];

    const data = {
      firstName: firstName,
      lastName: lastName,
      registrationForm: registrationFormBase64,
      registrationFormMimeType: registrationFormFile.type,
      photo: resizedPhotoBase64,
      photoMimeType: 'image/jpeg' // Wir verwenden JPEG als Standard für die verkleinerten Bilder
    };

    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbzU41aN7s9cLPfoEZ5Il01Tv6dg3bSPaXiIxrEhNdIUz9S7-QUr33YosWeXRs9qWaFV/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.status === 'success') {
        document.getElementById('output').innerHTML = `
          Dateien hochgeladen: <br>
          <a href="${result.registrationFileUrl}">Meldezettel</a><br>
          <a href="${result.photoFileUrl}">Passfoto</a>
        `;
      } else {
        alert('Fehler: ' + result.message);
      }
    } catch (error) {
      alert('Fehler: ' + error.toString());
    }
  };
}

function resizeImage(file, maxWidth, maxHeight, maxSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        } else {
          width = Math.round(width * maxHeight / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9; // Start quality
      canvas.toBlob(blob => {
        if (blob.size > maxSize) {
          quality -= 0.1;
          if (quality < 0.1) {
            reject(new Error("Image cannot be resized below 1 MB"));
            return;
          }
          resizeImageBlob(canvas, quality, resolve, reject);
        } else {
          resolve(URL.createObjectURL(blob));
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
  });
}

function resizeImageBlob(canvas, quality, resolve, reject) {
  canvas.toBlob(blob => {
    if (blob.size > maxSize) {
      quality -= 0.1;
      if (quality < 0.1) {
        reject(new Error("Image cannot be resized below 1 MB"));
        return;
      }
      resizeImageBlob(canvas, quality, resolve, reject);
    } else {
      resolve(URL.createObjectURL(blob));
    }
  }, 'image/jpeg', quality);
}

