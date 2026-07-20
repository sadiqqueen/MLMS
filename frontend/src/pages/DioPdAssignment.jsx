import Navbar from '../components/Navbar';
import { ProgramDirectorsPanel } from './DioAssignPds';
import './dio.css';

// ODIO "PD Assignment" screen — assign each Program Director to a specialty.
// Reuses the ProgramDirectorsPanel export from DioAssignPds.jsx (also rendered
// as a tab inside DioAssignments). Endpoints (unchanged):
//   GET   /api/dio/program-directors · GET /api/specialties
//   PATCH /api/dio/program-directors/:id  { specialtyId }
export default function DioPdAssignment() {
  return (
    <>
      <Navbar />
      <main className="mt-content">
        <ProgramDirectorsPanel />
      </main>
    </>
  );
}
