import { RequestHandler } from 'express';
import { drizzleClient } from '../db';
import { authorsTable } from '../db/schema';
import { inGroup } from '../db';
import { eq } from 'drizzle-orm';

const leaveSpace: RequestHandler = async (req, res) => {
	const { message } = req.body as { message: { from: string } };
	const fromExistingMember = await inGroup(message.from);
	if (!fromExistingMember) throw new Error('Access denied');
	if (fromExistingMember.frozen) throw new Error('Frozen persona');
	await drizzleClient.delete(authorsTable).where(eq(authorsTable.id, message.from));

	res.send({});
};

export default leaveSpace;
