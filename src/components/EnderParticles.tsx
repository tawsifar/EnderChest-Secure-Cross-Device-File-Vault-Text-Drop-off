import React, { useEffect, useRef } from 'react';

export default function EnderParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      life: number;
      maxLife: number;
      opacity: number;
      isRising: boolean;
      isBurst: boolean;

      constructor(x?: number, y?: number, isBurst = false) {
        this.size = Math.random() * 8 + 6; // 6 to 14 px for the + shape
        this.isBurst = isBurst;
        this.isRising = false;
        
        if (this.isBurst && x !== undefined && y !== undefined) {
          this.x = x + (Math.random() - 0.5) * 80;
          this.y = y + (Math.random() - 0.5) * 150;
          this.speedX = (Math.random() - 0.5) * 1.5;
          this.speedY = (Math.random() - 0.5) * 1.5;
          this.maxLife = Math.random() * 50 + 30; // short life for burst
        } else {
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height;
          
          // 10% chance to be a "rising" particle near the chest (simulated as bottom-left ish)
          this.isRising = Math.random() < 0.15;
          
          if (this.isRising) {
            // Spawn near bottom left (where chest roughly is)
            this.x = (Math.random() * 0.25 + 0.05) * canvas.width;
            this.y = canvas.height - (Math.random() * 0.2 + 0.1) * canvas.height;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = -Math.random() * 0.6 - 0.3; // Move up
          } else {
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
          }
          this.maxLife = Math.random() * 200 + 100;
        }

        this.life = Math.random() * (this.isBurst ? 0 : this.maxLife); 
        this.opacity = 0;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life++;

        if (this.life >= this.maxLife) {
          if (this.isBurst) return false; // mark for deletion
          
          this.life = 0;
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height;
          if (this.isRising) {
            this.x = (Math.random() * 0.25 + 0.05) * canvas.width;
            this.y = canvas.height - (Math.random() * 0.2 + 0.1) * canvas.height;
          }
        }

        // Fade in and out
        const halfLife = this.maxLife / 2;
        if (this.life < halfLife) {
          this.opacity = this.life / halfLife;
        } else {
          this.opacity = 1 - (this.life - halfLife) / halfLife;
        }
        return true;
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.opacity * 0.8);
        
        // Soft purple bloom
        ctx.shadowBlur = this.isBurst ? 16 : 12;
        ctx.shadowColor = '#c084fc'; // purple-400
        ctx.fillStyle = '#e9d5ff'; // purple-200
        
        // Draw + shape
        const thickness = Math.max(this.size / 3.5, 2);
        const center = this.size / 2;
        
        // Vertical bar
        ctx.fillRect(this.x + center - thickness / 2, this.y, thickness, this.size);
        // Horizontal bar
        ctx.fillRect(this.x, this.y + center - thickness / 2, this.size, thickness);
        
        ctx.restore();
      }
    }

    const init = () => {
      particles = [];
      const particleCount = Math.min(window.innerWidth / 15, 80); 
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };
    init();
    
    // Teleport Burst Logic
    let lastBurstTime = Date.now();
    let nextBurstDelay = Math.random() * 7000 + 8000; // 8 to 15 seconds

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const now = Date.now();
      if (now - lastBurstTime > nextBurstDelay) {
        lastBurstTime = now;
        nextBurstDelay = Math.random() * 7000 + 8000;
        
        // Trigger burst near left-middle (Enderman)
        const burstX = canvas.width * 0.15;
        const burstY = canvas.height * 0.6;
        for(let i = 0; i < 40; i++) {
          particles.push(new Particle(burstX, burstY, true));
        }
      }

      particles = particles.filter(p => {
        const keep = p.update();
        if (keep) p.draw();
        return keep;
      });
      
      // Replenish normal particles if they got deleted (though they usually reset)
      const targetCount = Math.min(window.innerWidth / 15, 80);
      const normalCount = particles.filter(p => !p.isBurst).length;
      if (normalCount < targetCount) {
        particles.push(new Particle());
      }

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ display: 'block' }}
    />
  );
}

