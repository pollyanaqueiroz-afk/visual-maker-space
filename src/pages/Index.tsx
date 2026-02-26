import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileImage, Lock } from 'lucide-react';

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-lg">
        <h1 className="text-4xl font-bold text-foreground">Curseduca Design</h1>
        <p className="text-lg text-muted-foreground">
          Solicite as artes da sua plataforma de forma prática e organizada.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/briefing">
              <FileImage className="h-5 w-5 mr-2" />
              Solicitar Briefing
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/login">
              <Lock className="h-5 w-5 mr-2" />
              Área da Equipe
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
