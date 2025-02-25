import { Request, Response } from 'express';
import { getUserFromRequest } from './authentication.controllers';
import prisma from '../core/prisma';
import { z } from 'zod';


export const getWorkgroupsController = async (req: Request, res: Response) => {
    try {
        const user = await getUserFromRequest(req);

        const response = await prisma.users_workgroups.findMany({
            where: {
                user_id: user.id
            },
            include: {
                workgroups: true
            }
        });
        res.json({workgroups: response});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const createWorkgroupController = async (req: Request, res: Response) => {
    const validation = z.object({
        group_name: z.string().nonempty(),
    });

    try {
        const user = await getUserFromRequest(req);
        const groupQuery = validation.parse(req.body);

        const workgroup = await prisma.workgroups.create({
            data: {
                group_name: groupQuery.group_name,
                creator_id: user.id,
                private: false
            }
        });

        const newWorkgroup = await prisma.users_workgroups.create({
            data: {
                user_id: user.id,
                group_id: workgroup.id,
                create_right: true,
                update_right: true,
                delete_right: true
            }
        });
        res.json({workgroup: newWorkgroup});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const addUserToWorkgroupController = async (req: Request, res: Response) => {
    const validation = z.object({
        email: z.string().nonempty(),
        create_right: z.boolean().nullable().optional(),
        update_right: z.boolean().nullable().optional(),
        delete_right: z.boolean().nullable().optional(),
        groupId: z.string().nonempty(),
    });

    try {
        const query = validation.parse(req.body);
        await getUserFromRequest(req);

        const user = await prisma.users.findUnique({ where: { email: query.email }  });

        if (!user) throw new Error('Invalid User');

        const group = await prisma.workgroups.findUnique({where: {id: query.groupId}});

        if (!group) throw new Error('Group Not Found');


        if ((await prisma.users_workgroups.findFirst({ where: { user_id: user.id, group_id: group.id } }))) throw new Error('User already in the group');

        await prisma.users_workgroups.create({
            data: {
                user_id: user.id,
                group_id: group.id,
                create_right: !!query?.create_right,
                update_right: !!query?.update_right,
                delete_right: !!query?.delete_right
            }
        });

        res.json({success: true});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteWorkgroupController = async (req: Request, res: Response) => {
    const validation = z.object({
        group_id: z.string().nonempty()
    });

    try {
        const query = validation.parse(req.body);
        const user = await getUserFromRequest(req);

        const relation = await prisma.users_workgroups.findFirst({
            where: {
                user_id: user.id,
                group_id: query.group_id
            }
        });

        if (!relation.delete_right) throw new Error('User cannot delete the group');

        await prisma.users_workgroups.deleteMany({
            where: {
                group_id: query.group_id
            }
        });

        const response = await prisma.workgroups.delete({
            where: {
                id: query.group_id
            }
        });

        res.json({success: true, response});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateUserRightController = async (req: Request, res: Response) => {
    const validation = z.object({
        userId: z.string().nonempty(),
        groupId: z.string().nonempty(),
        rights: z.object({
            create_right: z.boolean(),
            update_right: z.boolean(),
            delete_right: z.boolean()
        })
    });
    try {
        const query = validation.parse(req.body);

        const user = await getUserFromRequest(req);

        const workgroup = await prisma.workgroups.findFirst({ where: { id: query.groupId } });
        if (!workgroup) throw new Error('Workgroup not found');

        if (workgroup.creator_id !== user.id) throw new Error('Non-admin user can\'t edit rights');

        const updatedUser = await prisma.users.findFirst({ where: { id: query.userId } });
        if (!updatedUser) throw new Error('User not found');

        const response = await prisma.users_workgroups.updateMany({
            where: {
                user_id: updatedUser.id,
                group_id: workgroup.id
            },
            data: {
                create_right: !!query.rights.create_right,
                update_right: !!query.rights.update_right,
                delete_right: !!query.rights.delete_right
            }
        });

        res.json({success: true, response});

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const removeUserOfWorkgroupController = async (req: Request, res: Response) => {
    const validation = z.object({
        userId: z.string().nonempty(),
        groupId: z.string().nonempty(),
    });
    try {
        const query = validation.parse(req.body);

        const user = await getUserFromRequest(req);

        const workgroup = await prisma.workgroups.findFirst({ where: { id: query.groupId } });
        if (!workgroup) throw new Error('Workgroup not found');

        if (workgroup.creator_id !== user.id) throw new Error('Non-admin user can\'t remove user');

        const removedUser = await prisma.users.findFirst({ where: { id: query.userId } });
        if (!removedUser) throw new Error('User not found');

        const response = await prisma.users_workgroups.deleteMany({
            where: {
                user_id: removedUser.id,
                group_id: workgroup.id
            }
        });

        res.json({success: true, response});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};