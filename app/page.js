import DesignComponent from '../components/DesignComponent';

export default function Home() {
  return (
    <DesignComponent
      waNumber={process.env.NEXT_PUBLIC_WA_NUMBER ?? ''}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vinmelagency.com'}
    />
  );
}
