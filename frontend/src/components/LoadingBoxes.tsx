/**
 * Two isometric cubes hopping in alternation, beneath a soft contact shadow —
 * recreates the silhouette/motion of dribbble.com/shots/5533600-Loading-boxes in
 * pure CSS (clip-path faces, no image assets) so it stays crisp at button scale.
 */
export function LoadingBoxes({ className = "" }: { className?: string }) {
  return (
    <span className={`loading-boxes ${className}`} role="presentation" aria-hidden="true">
      <span className="loading-boxes__cube loading-boxes__cube--a">
        <span className="loading-boxes__face loading-boxes__face--top" />
        <span className="loading-boxes__face loading-boxes__face--left" />
        <span className="loading-boxes__face loading-boxes__face--right" />
      </span>
      <span className="loading-boxes__cube loading-boxes__cube--b">
        <span className="loading-boxes__face loading-boxes__face--top" />
        <span className="loading-boxes__face loading-boxes__face--left" />
        <span className="loading-boxes__face loading-boxes__face--right" />
      </span>
      <span className="loading-boxes__shadow" />
    </span>
  );
}
