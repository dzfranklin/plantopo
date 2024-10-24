import { ContourGuessrMap } from '@/app/contourguessr/ContourGuessrMap';
import { ContourGuessrPhoto } from '@/app/contourguessr/ContourGuessrPhoto';
import { useMemo, useState } from 'react';
import { ViewID } from '@/app/contourguessr/views';
import { Button } from '@/components/button';
import { metersBetween } from '@/geo';
import cls from '@/cls';
import { Dialog } from '@/components/dialog';
import { CopyText } from '@/components/CopyText';

interface Game {
  id: string;
  map: ViewID;
  photo: GamePhoto;
}

interface GamePhoto {
  point: [number, number];
  title: string;
  attributionText: string;
  attributionLink: string;
  dateTaken: string;
  full: { width: number; height: number; url: string };
  small: { width: number; height: number; url: string };
}

export function ContourGuessrGame({
  game,
  newGame,
}: {
  game: Game;
  newGame: () => void;
}) {
  const { photo } = game;

  const [guess, setGuess] = useState<[number, number] | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const answerMeters = useMemo(() => {
    if (guess && showAnswer) {
      return metersBetween(guess, photo.point);
    } else {
      return null;
    }
  }, [guess, photo.point, showAnswer]);

  return (
    <div className="h-full max-h-full sm:grid grid-cols-2 grid-rows-1">
      <div className="sm:min-w-[600px] sm:min-h-[600px]">
        <ContourGuessrMap
          view={game.map}
          target={photo.point}
          boundsMeters={1000}
          guess={guess}
          setGuess={setGuess}
          showAnswer={showAnswer}
        />
      </div>

      <div className="max-h-[600px] m-4">
        <ContourGuessrPhoto
          width={photo.full.width}
          height={photo.full.height}
          url={photo.full.url}
          attributionText={photo.attributionText}
          attributionLink={photo.attributionLink}
          dateTaken={photo.dateTaken}
        />

        <div className="space-y-4">
          {!answerMeters && (
            <Button
              color="blue"
              disabled={!guess}
              onClick={() => setShowAnswer(true)}
            >
              Guess
            </Button>
          )}

          {answerMeters && (
            <div className="space-y-4">
              <p className={cls(accuracyTextColor(answerMeters))}>
                Your guess is {Math.round(answerMeters)} meters from the correct
                answer.
              </p>

              <div className="flex flex-row items-baseline gap-4">
                <Button color="blue" onClick={() => newGame()}>
                  New game
                </Button>
                <Button onClick={() => setShowShare(true)}>
                  Share this challenge
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ShareDialog
        gameID={game.id}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </div>
  );
}

function accuracyTextColor(meters: number): string {
  if (meters >= 100) {
    return 'text-red-600';
  } else if (meters >= 20) {
    return 'text-yellow-700';
  } else {
    return 'text-green-600';
  }
}

function ShareDialog({
  gameID,
  open,
  onClose,
}: {
  gameID: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <Dialog.Title>Share this challenge</Dialog.Title>
      <Dialog.Body>
        <CopyText
          value={'https://plantopo.com/cg/' + encodeURIComponent(gameID)}
          fullWidth
        />
      </Dialog.Body>
      <Dialog.Actions>
        <Button onClick={() => onClose()} color="primary">
          Done
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}
