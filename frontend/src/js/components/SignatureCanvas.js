/**
 * Componente SignatureCanvas - Captura Táctil de Firma Manuscrita
 * Cumple con Sprint 9.5 (HU-13) y directrices visuales de DESIGN_RULES.md
 * Soporta lápiz óptico (stylus), dedos en smartphones/tablets y puntero en escritorio.
 */
export class SignatureCanvas {
  constructor(canvasElement, options = {}) {
    if (!canvasElement) {
      throw new Error('SignatureCanvas requiere un elemento <canvas>');
    }

    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.strokeColor = options.strokeColor || '#24285B'; // Tinta índigo clínica
    this.lineWidth = options.lineWidth || 2.5;
    this.isDrawing = false;
    this.pointsCount = 0;
    this.lastX = 0;
    this.lastY = 0;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onResize = this._onResize.bind(this);

    this.init();
  }

  init() {
    this.setupCanvasDimensions();

    this.canvas.style.touchAction = 'none'; // Evitar scroll al arrastrar el dedo
    this.canvas.style.cursor = 'crosshair';

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('resize', this._onResize);
  }

  setupCanvasDimensions() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 480;
    const height = rect.height || 180;
    const dpr = window.devicePixelRatio || 1;

    // Ajustar resolución interna para pantallas Retina/Móvil
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.lineWidth;
  }

  _getCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();

    this.isDrawing = true;
    const coords = this._getCoordinates(e);
    this.lastX = coords.x;
    this.lastY = coords.y;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.pointsCount++;
  }

  _onPointerMove(e) {
    if (!this.isDrawing) return;
    e.preventDefault();

    const coords = this._getCoordinates(e);

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();

    this.lastX = coords.x;
    this.lastY = coords.y;
    this.pointsCount++;
  }

  _onPointerUp(e) {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.ctx.closePath();
    }
  }

  _onResize() {
    // Si se redimensiona, guardar imagen temporal y restaurar
    const tempImage = this.toDataURL();
    const prevPoints = this.pointsCount;
    this.setupCanvasDimensions();

    if (prevPoints > 0) {
      const img = new Image();
      img.onload = () => {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = tempImage;
    }
  }

  clear() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.pointsCount = 0;
  }

  isEmpty() {
    return this.pointsCount < 5;
  }

  toDataURL(type = 'image/png') {
    return this.canvas.toDataURL(type);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('resize', this._onResize);
  }
}
